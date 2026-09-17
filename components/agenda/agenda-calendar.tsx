"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getFrenchHolidays } from "@/lib/holidays-fr";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DEFAULT_AGENDA_COULEURS,
  cleEvenement,
  couleurEvenement,
  styleEvenement,
  type AgendaCategory,
  type AgendaCouleurs,
  type CouleursEvenements,
} from "@/lib/agenda-colors";
import { CouleurEvenementDialog } from "@/components/agenda/couleur-evenement-dialog";
import {
  CLE_VUE_AGENDA,
  JOURS_LISTE,
  LABELS_VUE,
  VUES_AGENDA,
  ajouterJours,
  comparerHoraire,
  creneauDepuisHeures,
  dansFenetre,
  joursAvecEvenements,
  joursSemaine,
  libelleJour,
  libelleJourLong,
  libelleSemaine,
  moisDe,
  naviguer,
  vueInitiale,
  type VueAgenda,
} from "@/lib/agenda-vues";
import { statsDuMois, statutFacturation } from "@/lib/agenda-facturation";
import { appliquerChangement, type ChangementOptimiste } from "@/lib/agenda-optimiste";
import {
  aChange,
  deplacer,
  estDeplacable,
  libelleDeplacement,
  valeursActuelles,
  type CibleDeplacement,
  type ValeursDeplacement,
} from "@/lib/agenda-deplacement";
import { deplacerInterventionAction } from "@/lib/actions/interventions";
import { useDeplacement } from "@/components/agenda/use-deplacement";
import { AFacturerPanel } from "@/components/agenda/a-facturer-panel";
import { BandeauJours } from "@/components/agenda/bandeau-jours";
import { useGlissement } from "@/components/agenda/use-glissement";
import { EvenementDetailSheet } from "@/components/agenda/evenement-detail-sheet";
import { VueGrilleHoraire } from "@/components/agenda/vue-grille-horaire";
import { LigneEvenement, VueListe } from "@/components/agenda/vue-liste";
import {
  getAgendaExternes,
  type AgendaData,
  type AgendaEvent,
  type AgendaExternes,
} from "@/lib/actions/agenda";
import type {
  ClientOption,
  InterventionEditData,
} from "@/components/agenda/quick-intervention-dialog";

// Dialogues chargés à la première ouverture seulement : ils ne pèsent
// pas sur l'affichage initial de l'agenda.
const QuickInterventionDialog = dynamic(
  () => import("@/components/agenda/quick-intervention-dialog").then((m) => m.QuickInterventionDialog),
  { ssr: false },
);
const RdvARattacherDialog = dynamic(
  () => import("@/components/agenda/rdv-a-rattacher-dialog").then((m) => m.RdvARattacherDialog),
  { ssr: false },
);

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const JOURS_FR_SHORT = ["L", "M", "M", "J", "V", "S", "D"];
const JOURS_FR_FULL = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Génère la grille de 42 cases (6 lignes × 7 jours) pour le mois.
 * Semaine commence le lundi (norme FR).
 */
function buildMonthGrid(year: number, month1to12: number): Date[] {
  const firstDay = new Date(year, month1to12 - 1, 1);
  // getDay() : 0=dim, 1=lun, ... 6=sam → on veut 0=lun, 6=dim
  const offset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function eventCoversDate(e: AgendaEvent, ymd: string): boolean {
  return ymd >= e.date_start && ymd <= e.date_end;
}

/**
 * Catégorie de couleur d'un évènement (la logique métier est inchangée :
 * une intervention facturée prend la couleur « facturée », un RDV
 * iPhone facturé aussi, une facture en retard la couleur « en retard »).
 * Une facture annulée garde son rendu barré, sans couleur choisie.
 */
function eventCategorie(e: AgendaEvent, aujourdhui: string): AgendaCategory | "annulee" {
  if (e.kind === "intervention") {
    const statut = statutFacturation(e, aujourdhui);
    return statut === "facturee"
      ? "intervention_facturee"
      : statut === "sans_facturation"
        ? "sans_facturation"
        : statut === "prevue"
          ? "intervention_prevue"
          : "intervention_a_facturer";
  }
  if (e.kind === "facture_prestation") {
    if (e.statut === "retard") return "retard";
    if (e.statut === "annulee") return "annulee";
    return "facture";
  }
  if (e.kind === "devis_planifie") return "devis";
  if (e.kind === "external") {
    return e.facture_emise ? "intervention_facturee" : "external";
  }
  return "maintenance";
}

const CLASSES_ANNULEE =
  "bg-slate-100 text-slate-500 line-through hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400";

/**
 * Style inline de la pastille : la couleur propre de l'évènement si
 * elle existe, sinon celle de son type, avec un texte sombre ou clair
 * choisi automatiquement pour rester lisible.
 */
function eventStyle(
  e: AgendaEvent,
  couleurs: AgendaCouleurs,
  parEvenement: CouleursEvenements,
  aujourdhui: string,
): React.CSSProperties | undefined {
  const cat = eventCategorie(e, aujourdhui);
  if (cat === "annulee") return undefined;
  return styleEvenement(couleurEvenement(cat, cleEvenement(e), couleurs, parEvenement));
}

/** Convertit "HH:MM:SS" en "HH:MM" pour un affichage compact. */
function shortTime(t: string | null): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

/** Préfixe horaire affiché dans la pill ("09:00–12:00 · " ou "09:00 · " ou ""). */
function eventTimePrefix(e: AgendaEvent): string {
  const start = shortTime(e.heure_debut);
  const end = shortTime(e.heure_fin);
  if (start && end) return `${start}–${end} · `;
  if (start) return `${start} · `;
  return "";
}

function eventShortLabel(e: AgendaEvent): string {
  if (e.kind === "intervention") {
    // Priorité à la description saisie par l'utilisateur (c'est l'info la
    // plus parlante), avec le client en complément si la place reste.
    const base = e.description
      ? e.client_nom
        ? `${e.description} · ${e.client_nom}`
        : e.description
      : (e.client_nom ?? e.title);
    return eventTimePrefix(e) + base;
  }
  if (e.kind === "facture_prestation") {
    return `${e.numero ?? ""} ${e.client_nom ? "· " + e.client_nom : ""}`.trim();
  }
  if (e.kind === "devis_planifie") {
    return `${e.numero ?? ""} ${e.client_nom ? "· " + e.client_nom : ""}`.trim();
  }
  if (e.kind === "external") {
    return eventTimePrefix(e) + (e.title || "(évènement)");
  }
  return e.client_nom ? `Visite · ${e.client_nom}` : "Visite";
}

export function AgendaCalendar({
  data,
  clients,
  couleurs = DEFAULT_AGENDA_COULEURS,
  couleursEvenements = {},
  date,
  vueUrl = null,
  externesCle = 0,
}: {
  data: AgendaData;
  clients: ClientOption[];
  couleurs?: AgendaCouleurs;
  /** Couleurs propres à certains évènements (clé « kind:id »). */
  couleursEvenements?: CouleursEvenements;
  /** Date sélectionnée (YYYY-MM-DD) — jour affiché, semaine et mois qui la contiennent. */
  date: string;
  /** Vue demandée dans l'URL (?vue=), null = dernier choix / défaut selon l'écran. */
  vueUrl?: string | null;
  /** Change à chaque rendu serveur : force le rechargement des RDV iPhone après un refresh. */
  externesCle?: number;
}) {
  const router = useRouter();
  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const { fenetre } = data;

  // Date affichée. À l'intérieur de la fenêtre chargée (le mois et ses
  // voisins), on change de jour, de semaine ou de mois sans repasser par
  // le serveur (un swipe doit être instantané) ; on ne recharge qu'en
  // sortant de la fenêtre. Mois et compteurs suivent la date affichée.
  const [dateCourante, setDateCourante] = useState(date);
  useEffect(() => setDateCourante(date), [date]);
  const { year, month } = moisDe(dateCourante);

  // Évènements = ceux du serveur + les mises à jour OPTIMISTES (un
  // rendez-vous planifié, modifié, supprimé ou passé « rien à facturer »
  // s'affiche tout de suite, le serveur confirme derrière) + les RDV
  // iPhone, chargés après l'affichage pour ne jamais le retarder.
  const [evenementsLocaux, setEvenementsLocaux] = useState<AgendaEvent[]>(data.events);
  useEffect(() => setEvenementsLocaux(data.events), [data.events]);
  const [externes, setExternes] = useState<AgendaExternes>({
    events: [],
    hasExternalCalendar: false,
    error: null,
  });
  const { debut: fenetreDebut, fin: fenetreFin } = fenetre;
  useEffect(() => {
    let actif = true;
    getAgendaExternes({ debut: fenetreDebut, fin: fenetreFin })
      .then((r) => {
        if (actif) setExternes(r);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [fenetreDebut, fenetreFin, externesCle]);
  const events = useMemo(
    () => [...evenementsLocaux, ...externes.events],
    [evenementsLocaux, externes.events],
  );
  const stats = useMemo(
    () => statsDuMois(events, year, month, todayYmd),
    [events, year, month, todayYmd],
  );
  const appliquerOptimiste = (c: ChangementOptimiste) => {
    const avant = evenementsLocaux;
    setEvenementsLocaux((prev) => appliquerChangement(prev, c));
    return () => setEvenementsLocaux(avant);
  };

  // Déplacement d'un rendez-vous (glisser-déposer) : l'agenda bouge tout
  // de suite, le serveur confirme derrière, et « Annuler » remet le
  // créneau à sa place (même mécanique, valeurs d'origine).
  const enregistrerDeplacement = async (
    id: string,
    valeurs: ValeursDeplacement,
    retour: ValeursDeplacement | null,
  ) => {
    const annuler = appliquerOptimiste({ type: "deplacement", id, valeurs });
    const res = await deplacerInterventionAction(id, valeurs);
    if (!res.ok) {
      annuler();
      toast.error("Déplacement refusé", { description: res.error });
      return;
    }
    if (retour) {
      toast.success(`Déplacé : ${libelleDeplacement(valeurs, todayYmd)}`, {
        duration: 6000,
        action: {
          label: "Annuler",
          onClick: () => void enregistrerDeplacement(id, retour, null),
        },
      });
    } else {
      toast.success("Remis à sa place");
    }
    router.refresh();
  };
  const deplacerRdv = (e: AgendaEvent, cible: CibleDeplacement) => {
    if (!estDeplacable(e)) return;
    const valeurs = deplacer(e, cible);
    if (!aChange(e, valeurs)) return;
    void enregistrerDeplacement(e.id, valeurs, valeursActuelles(e));
  };
  // Vue mois : on dépose sur une case (le jour change, les heures restent).
  const deplacementMois = useDeplacement<AgendaEvent, CibleDeplacement>({
    resoudre: (_e, p) => {
      const jour = document
        .elementFromPoint(p.x, p.y)
        ?.closest<HTMLElement>("[data-jour-mois]")?.dataset.jourMois;
      return jour ? { jour } : null;
    },
    onDeposer: deplacerRdv,
  });
  const glisseMois = deplacementMois.enCours;

  // Petit écran (téléphone) : l'agenda principal se pilote au doigt,
  // l'écran est allégé (stats, légende et bandeau masqués, « + » flottant).
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const maj = () => setMobile(mq.matches);
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);

  // Sens du dernier déplacement, pour la petite animation de glissement.
  const [glisse, setGlisse] = useState<"gauche" | "droite" | null>(null);

  // Vue : URL > dernier choix (localStorage) > liste sur mobile, mois
  // sur desktop. Sans indication dans l'URL, on attend le montage pour
  // lire le choix mémorisé (pas de flash d'une autre vue).
  const [vue, setVue] = useState<VueAgenda | null>(() =>
    vueUrl ? vueInitiale({ depuisUrl: vueUrl, mobile: false }) : null,
  );
  useEffect(() => {
    if (vue) return;
    let memorisee: string | null = null;
    try {
      memorisee = localStorage.getItem(CLE_VUE_AGENDA);
    } catch {}
    const mobile = window.matchMedia("(max-width: 639px)").matches;
    setVue(vueInitiale({ memorisee, mobile }));
  }, [vue]);

  const choisirVue = (v: VueAgenda) => {
    setVue(v);
    try {
      localStorage.setItem(CLE_VUE_AGENDA, v);
    } catch {}
    // Les données de la fenêtre sont déjà là : pas de rechargement.
    window.history.replaceState(null, "", `/agenda?vue=${v}&date=${dateCourante}`);
  };

  // Fiche d'un évènement (vues jour / semaine / liste)
  const [detail, setDetail] = useState<AgendaEvent | null>(null);
  // Liste des RDV iPhone à rattacher (bandeau cliquable)
  const [rattacherOuvert, setRattacherOuvert] = useState(false);

  // Couleur d'un évènement précis (dialogue)
  const [cibleCouleur, setCibleCouleur] = useState<AgendaEvent | null>(null);
  const cibleDialogue = useMemo(() => {
    if (!cibleCouleur) return null;
    const cat = eventCategorie(cibleCouleur, todayYmd);
    if (cat === "annulee") return null;
    const cle = cleEvenement(cibleCouleur);
    return {
      cle,
      libelle: eventShortLabel(cibleCouleur),
      couleurActuelle: couleurEvenement(cat, cle, couleurs, couleursEvenements),
      couleurDuType: couleurs[cat],
      aCouleurPropre: cle in couleursEvenements,
    };
  }, [cibleCouleur, couleurs, couleursEvenements, todayYmd]);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // Jours fériés FR du mois affiché (+ mois précédent/suivant pour les
  // cases débordantes de la grille).
  const holidays = useMemo(() => {
    const prevYear = month === 1 ? year - 1 : year;
    const nextYear = month === 12 ? year + 1 : year;
    return {
      ...getFrenchHolidays(prevYear),
      ...getFrenchHolidays(year),
      ...getFrenchHolidays(nextYear),
    };
  }, [year, month]);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState(todayYmd);
  // Créneau pré-rempli (vues jour / semaine : l'heure cliquée ; la vue
  // mois et le bouton « Planifier » ne passent que la date).
  const [quickAddCreneau, setQuickAddCreneau] = useState<{
    heure_debut: string;
    heure_fin: string;
  } | null>(null);
  const [editTarget, setEditTarget] = useState<InterventionEditData | null>(null);
  // Dialogues montés à la première ouverture (chargement différé).
  const [quickMonte, setQuickMonte] = useState(false);
  const [rattacherMonte, setRattacherMonte] = useState(false);
  const ouvrirRattacher = () => {
    setRattacherMonte(true);
    setRattacherOuvert(true);
  };
  // Vue Mois sur téléphone : un tap sur un jour montre ses rendez-vous
  // en dessous (au lieu d'ouvrir « Planifier » directement).
  const [jourSelectionne, setJourSelectionne] = useState<string | null>(null);

  const openQuickAdd = (ymd: string, heures?: { debut: number; fin: number }) => {
    setQuickMonte(true);
    setEditTarget(null);
    setQuickAddDate(ymd);
    setQuickAddCreneau(heures ? creneauDepuisHeures(heures.debut, heures.fin) : null);
    setQuickAddOpen(true);
  };

  const openEdit = (e: AgendaEvent) => {
    if (e.kind !== "intervention") return;
    setQuickMonte(true);
    setEditTarget({
      id: e.id,
      client_id: e.client_id,
      date_intervention: e.date_start,
      date_fin: e.date_end !== e.date_start ? e.date_end : null,
      heure_debut: e.heure_debut,
      heure_fin: e.heure_fin,
      type: e.type_activite ?? "installation",
      description: e.description,
      a_facturer: e.a_facturer ?? true,
      serie_id: e.serie_id ?? null,
      recurrence: e.recurrence ?? null,
    });
    setQuickAddOpen(true);
  };

  const allerA = (d: string, sens: 1 | -1 | null = null) => {
    setGlisse(sens === 1 ? "gauche" : sens === -1 ? "droite" : null);
    const v = vue ?? "mois";
    if (dansFenetre(v, d, fenetre)) {
      setDateCourante(d);
      window.history.replaceState(null, "", `/agenda?vue=${v}&date=${d}`);
    } else {
      router.push(`/agenda?vue=${v}&date=${d}`);
    }
  };
  const prevMonth = () => allerA(naviguer(vue ?? "mois", dateCourante, -1), -1);
  const nextMonth = () => allerA(naviguer(vue ?? "mois", dateCourante, 1), 1);
  const goToday = () => allerA(todayYmd);
  // Swipe gauche / droite sur le contenu : jour, semaine ou mois suivant.
  const glissement = useGlissement((sens) => {
    if (!vue || vue === "liste") return;
    allerA(naviguer(vue, dateCourante, sens), sens);
  });

  const titre =
    vue === "jour"
      ? libelleJourLong(dateCourante)
      : vue === "semaine"
        ? libelleSemaine(dateCourante)
        : vue === "liste"
          ? `${JOURS_LISTE} prochains jours`
          : `${MOIS_FR[month - 1]} ${year}`;

  const styleDe = (e: AgendaEvent) => eventStyle(e, couleurs, couleursEvenements, todayYmd);

  const inMonth = (e: AgendaEvent) => {
    const debutMois = `${year}-${String(month).padStart(2, "0")}-01`;
    const finMois = toYmd(new Date(year, month, 0));
    return e.date_end >= debutMois && e.date_start <= finMois;
  };
  // RDV iPhone passés, non rattachés (un RDV futur n'est pas encore à facturer).
  const rdvARattacher = events.filter(
    (e) => e.kind === "external" && !e.facture_emise && inMonth(e) && e.date_start <= todayYmd,
  );
  const nbAFacturer = data.aFacturer.length + stats.nbExternalAFacturer;

  return (
    <div className="space-y-4">
      {/* Stats du mois (desktop) */}
      <div className="hidden grid-cols-2 gap-3 sm:grid md:grid-cols-4">
        <StatCard
          label="À facturer"
          value={nbAFacturer}
          hint={
            stats.nbExternalAFacturer > 0
              ? `${data.aFacturer.length} intervention(s) passée(s) + ${stats.nbExternalAFacturer} RDV iPhone`
              : `intervention(s) passée(s) sans facture, tous mois`
          }
          tone={nbAFacturer > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Factures"
          value={stats.nbFactures}
          hint="prestations facturées"
        />
        <StatCard label="Devis planifiés" value={stats.nbDevis} hint="travaux prévus" />
        <StatCard label="Visites maint." value={stats.nbVisites} hint="contrats" />
      </div>

      {/* Mobile : une seule puce « à facturer » remplace les stats et le bandeau */}
      {nbAFacturer > 0 && (
        <button
          type="button"
          onClick={() =>
            stats.nbExternalAFacturer > 0 ? ouvrirRattacher() : choisirVue("liste")
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 sm:hidden"
        >
          <AlertCircle className="size-3.5" />
          {nbAFacturer} à facturer
          {stats.nbExternalAFacturer > 0 && " · RDV iPhone à rattacher"}
        </button>
      )}

      {/* Toolbar : navigation mois.
          Mobile : 2 lignes (nav + bouton Planifier en haut, légende dessous).
          Desktop : 1 ligne (nav à gauche, planifier + légende à droite). */}
      <div className="space-y-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={prevMonth}
            aria-label="Mois précédent"
            className="h-9 w-9"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            aria-label="Mois suivant"
            className="h-9 w-9"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="px-2 sm:px-3"
          >
            Aujourd'hui
          </Button>
          <h2 className="ml-auto text-sm font-semibold tracking-tight sm:ml-2 sm:text-lg">
            {titre}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur de vue : Jour | Semaine | Mois | Liste */}
          <div
            role="tablist"
            aria-label="Vue de l'agenda"
            className="inline-flex rounded-md border bg-muted/40 p-0.5"
          >
            {VUES_AGENDA.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={vue === v}
                onClick={() => choisirVue(v)}
                className={cn(
                  "min-h-9 rounded px-3 text-xs font-medium transition-colors sm:text-sm",
                  vue === v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {LABELS_VUE[v]}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            onClick={() => openQuickAdd(todayYmd)}
            className="hidden sm:inline-flex"
          >
            <Plus className="size-4" />
            Planifier
          </Button>
          <div className="max-sm:hidden">
            <Legend couleurs={couleurs} />
          </div>
        </div>
      </div>

      {/* Erreur calendrier externe */}
      {externes.error && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          ⚠︎ Impossible de récupérer votre calendrier téléphone :{" "}
          {externes.error}
        </div>
      )}

      {/* PC : panneau « À facturer » — passées sans facture, tous mois, + RDV iPhone */}
      <AFacturerPanel
        items={data.aFacturer}
        nbExternal={stats.nbExternalAFacturer}
        onRattacher={ouvrirRattacher}
        className="max-sm:hidden"
      />

      {/* Vues jour / semaine / liste ; le mois garde sa grille ci-dessous.
          Le conteneur écoute le swipe ; la clé relance la petite
          animation de glissement à chaque changement de date. */}
      <div {...glissement} className="touch-pan-y">
      <div
        key={`${vue}-${dateCourante}`}
        className={cn(
          "space-y-3",
          glisse === "gauche" && "animate-in fade-in slide-in-from-right-6 duration-200",
          glisse === "droite" && "animate-in fade-in slide-in-from-left-6 duration-200",
        )}
        onAnimationEnd={() => setGlisse(null)}
      >
      {vue === null && (
        <div className="h-64 animate-pulse rounded-lg border bg-muted/30" aria-hidden="true" />
      )}
      {vue === "jour" && (
        <BandeauJours
          date={dateCourante}
          aujourdhui={todayYmd}
          joursCharges={joursAvecEvenements(events, joursSemaine(dateCourante))}
          onChoisir={(d) => allerA(d, d > dateCourante ? 1 : d < dateCourante ? -1 : null)}
          onSemaine={(sens) => allerA(ajouterJours(dateCourante, 7 * sens), sens)}
        />
      )}
      {(vue === "jour" || vue === "semaine") && (
        <VueGrilleHoraire
          mode={vue}
          date={dateCourante}
          aujourdhui={todayYmd}
          events={events}
          holidays={holidays}
          style={styleDe}
          onOuvrir={setDetail}
          onPlanifier={openQuickAdd}
          onDeplacer={deplacerRdv}
        />
      )}
      {vue === "liste" && (
        <VueListe
          events={events}
          aujourdhui={todayYmd}
          nbJours={JOURS_LISTE}
          style={styleDe}
          onOuvrir={setDetail}
          onPlanifier={openQuickAdd}
        />
      )}

      {/* Calendrier (vue mois, inchangée) */}
      {vue === "mois" && (
      <Card>
        <CardContent className="p-0">
          {/* Entête jours */}
          <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {JOURS_FR_FULL.map((j, i) => (
              <div
                key={j}
                className={cn("px-1 py-2 sm:px-2", (i === 5 || i === 6) && "font-semibold")}
              >
                <span className="sm:hidden">{JOURS_FR_SHORT[i]}</span>
                <span className="hidden sm:inline">{j}</span>
              </div>
            ))}
          </div>
          {/* Grille jours */}
          <div className="grid grid-cols-7">
            {grid.map((day, idx) => {
              const ymd = toYmd(day);
              const isCurrentMonth = day.getMonth() === month - 1;
              const isToday = ymd === todayYmd;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const holidayName = holidays[ymd] ?? null;
              const isHoliday = Boolean(holidayName);
              const dayEvents = events.filter((e) => eventCoversDate(e, ymd));

              return (
                <div
                  key={idx}
                  data-jour-mois={ymd}
                  onClick={() => (mobile ? setJourSelectionne(ymd) : openQuickAdd(ymd))}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      if (mobile) setJourSelectionne(ymd);
                      else openQuickAdd(ymd);
                    }
                  }}
                  title={
                    holidayName
                      ? `${holidayName} — Cliquez pour planifier`
                      : "Cliquez pour planifier une intervention"
                  }
                  // Teinte de la case (week-end / férié) : la couleur
                  // choisie, atténuée — plus légère en mode sombre.
                  style={
                    isCurrentMonth && (isHoliday || isWeekend)
                      ? ({ "--teinte": isHoliday ? couleurs.ferie : couleurs.weekend } as React.CSSProperties)
                      : undefined
                  }
                  className={cn(
                    "group relative min-h-[70px] cursor-pointer border-b border-r p-1 text-xs transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[110px] sm:p-1.5",
                    idx % 7 === 6 && "border-r-0",
                    idx >= 35 && "border-b-0",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground/60",
                    mobile && jourSelectionne === ymd && "ring-2 ring-inset ring-primary",
                    glisseMois?.cible?.jour === ymd && "bg-primary/10 ring-2 ring-inset ring-primary",
                    isCurrentMonth && (isHoliday || isWeekend) &&
                      "bg-[color-mix(in_srgb,var(--teinte)_55%,transparent)] dark:bg-[color-mix(in_srgb,var(--teinte)_22%,transparent)]",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                        isToday && "bg-primary text-primary-foreground",
                        !isToday && (isHoliday || isWeekend) && "font-semibold",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {isCurrentMonth && dayEvents.length > 2 && (
                        <span className="text-[9px] text-muted-foreground sm:hidden">
                          +{dayEvents.length - 2}
                        </span>
                      )}
                      {isCurrentMonth && dayEvents.length > 3 && (
                        <span className="hidden text-[10px] text-muted-foreground sm:inline">
                          +{dayEvents.length - 3}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Plus className="size-3" />
                      </span>
                    </div>
                  </div>
                  {holidayName && isCurrentMonth && (
                    <div className="mb-1 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {holidayName}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e, evIdx) => {
                      const isIntervention = e.kind === "intervention";
                      const styleEv = eventStyle(e, couleurs, couleursEvenements, todayYmd);
                      const commonClass = cn(
                        "block w-full text-left line-clamp-1 break-words rounded px-1 py-0.5 pr-4 text-[10px] leading-tight transition-[filter] hover:brightness-95 dark:hover:brightness-110 sm:line-clamp-2 sm:px-1.5 sm:pr-4 sm:text-[11px]",
                        // Liseré discret : une couleur très sombre reste
                        // repérable sur le fond du mode sombre (et une
                        // très claire sur le mode clair).
                        styleEv !== undefined && "ring-1 ring-inset ring-black/10 dark:ring-white/20",
                        styleEv === undefined && CLASSES_ANNULEE,
                      );
                      // Bouton « couleur de cet évènement » : à droite de
                      // la pastille (frère, pas enfant : un bouton dans un
                      // lien n'est pas du HTML valide). Discret sur
                      // desktop (visible au survol), toujours visible mais
                      // petit sur mobile.
                      const boutonCouleur = styleEv && (
                        <button
                          type="button"
                          aria-label="Couleur de cet évènement"
                          title="Couleur de cet évènement"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setCibleCouleur(e);
                          }}
                          className="absolute right-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full border border-black/30 bg-white/80 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover/ev:opacity-100"
                        />
                      );
                      const envelopper = (contenu: React.ReactNode) => (
                        <div
                          key={`${e.kind}-${e.id}-${ymd}`}
                          className={cn(
                            "group/ev relative",
                            // 3e évènement masqué sur mobile pour gagner de la place
                            evIdx === 2 && "hidden sm:block",
                          )}
                        >
                          {contenu}
                          {boutonCouleur}
                        </div>
                      );
                      const tooltip = `${e.description ? e.description + " — " : ""}${e.client_nom ?? e.title}${isIntervention ? "\n(Cliquez pour modifier)" : ""}`;
                      // Pour les interventions : clic ouvre le dialogue d'édition
                      // rapide (inline) plutôt que la fiche complète — plus rapide
                      // pour ajuster planning/description. Lien "Fiche complète"
                      // disponible dans le dialogue.
                      if (isIntervention) {
                        const deplacable = estDeplacable(e);
                        return envelopper(
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openEdit(e);
                            }}
                            {...(deplacable ? deplacementMois.poignee(e) : {})}
                            className={cn(
                              commonClass,
                              deplacable && "poignee-deplacement cursor-grab active:cursor-grabbing",
                              glisseMois?.e.id === e.id && "opacity-40",
                            )}
                            style={styleEv}
                            title={deplacable ? `${tooltip}\n(Glisser pour déplacer)` : tooltip}
                          >
                            {eventShortLabel(e)}
                          </button>,
                        );
                      }
                      // Évènements externes (calendrier iPhone) :
                      // - Non facturé : pill non cliquable, préfixe ⚠︎📱
                      // - Facturé : pill cliquable (lien vers la facture
                      //   rattachée), préfixe ✓📱
                      if (e.kind === "external") {
                        const prefix = e.facture_emise ? "✓📱" : "⚠︎📱";
                        const tooltip = e.facture_emise
                          ? `${e.title}${e.description ? "\n" + e.description : ""}\n📱 RDV iPhone — déjà facturé (${e.numero ?? "facture liée"}). Cliquer pour ouvrir la facture.`
                          : `${e.title}${e.description ? "\n" + e.description : ""}\n📱 Noté sur votre iPhone — pensez à créer la facture si c'est terminé`;
                        if (e.facture_emise && e.href !== "#") {
                          return envelopper(
                            <Link
                              href={e.href}
                              onClick={(ev) => ev.stopPropagation()}
                              className={commonClass}
                              style={styleEv}
                              title={tooltip}
                            >
                              {prefix} {eventShortLabel(e)}
                            </Link>,
                          );
                        }
                        return envelopper(
                          <div
                            onClick={(ev) => ev.stopPropagation()}
                            className={cn(commonClass, "cursor-default")}
                            style={styleEv}
                            title={tooltip}
                          >
                            {prefix} {eventShortLabel(e)}
                          </div>,
                        );
                      }
                      return envelopper(
                        <Link
                          href={e.href}
                          onClick={(ev) => ev.stopPropagation()}
                          className={commonClass}
                          style={styleEv}
                          title={tooltip}
                        >
                          {eventShortLabel(e)}
                        </Link>,
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Étiquette qui suit le doigt / la souris pendant un déplacement en vue mois */}
      {glisseMois && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 max-w-[60vw] truncate rounded-md px-2 py-1 text-xs font-medium shadow-lg ring-2 ring-primary"
          style={{
            ...styleDe(glisseMois.e),
            left: glisseMois.point.x + 12,
            top: glisseMois.point.y - 36,
          }}
        >
          {eventShortLabel(glisseMois.e)}
          {glisseMois.cible ? ` → ${libelleJour(glisseMois.cible.jour, todayYmd)}` : ""}
        </div>
      )}

      {/* Mois sur téléphone : les rendez-vous du jour touché */}
      {vue === "mois" && mobile && (
        <div className="space-y-1.5">
          {jourSelectionne ? (
            <>
              <h3 className="px-1 text-sm font-semibold">
                {libelleJour(jourSelectionne, todayYmd)}
              </h3>
              {(() => {
                const duJour = events
                  .filter((e) => eventCoversDate(e, jourSelectionne))
                  .sort(comparerHoraire);
                return duJour.length > 0 ? (
                  <ul className="divide-y overflow-hidden rounded-lg border bg-card">
                    {duJour.map((e) => (
                      <LigneEvenement key={`${e.kind}-${e.id}`} e={e} style={styleDe} onOuvrir={setDetail} />
                    ))}
                  </ul>
                ) : (
                  <p className="px-1 text-sm text-muted-foreground">
                    Rien ce jour-là — le bouton + planifie ici.
                  </p>
                );
              })()}
            </>
          ) : (
            <p className="px-1 text-xs text-muted-foreground">
              Touchez un jour pour voir ses rendez-vous.
            </p>
          )}
        </div>
      )}
      </div>
      </div>

      <p className="hidden text-xs text-muted-foreground sm:block">
        Cliquez sur une case du calendrier pour planifier une intervention,
        ou sur un évènement existant pour ouvrir sa fiche ; glissez un
        rendez-vous pour le déplacer. Tout ce qui est
        en{" "}
        <span
          className="inline-block size-2.5 rounded-full align-middle"
          style={styleEvenement(couleurs.intervention_a_facturer)}
          aria-hidden="true"
        />{" "}
        <span className="font-medium">⚠︎</span> est <strong>à facturer</strong> — interventions sans facture
        associée ou RDV notés sur l'iPhone (préfixe 📱).
      </p>

      {/* Bouton flottant (téléphone) : planifier sur le jour affiché ou touché */}
      <button
        type="button"
        aria-label="Planifier une intervention"
        onClick={() =>
          openQuickAdd(
            vue === "mois"
              ? (jourSelectionne ?? todayYmd)
              : vue === "liste" || vue === null
                ? todayYmd
                : dateCourante,
          )
        }
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90 sm:hidden"
      >
        <Plus className="size-7" />
      </button>
      <div aria-hidden className="h-14 sm:hidden" />

      {quickMonte && (
        <QuickInterventionDialog
          open={quickAddOpen}
          onOpenChange={(next) => {
            setQuickAddOpen(next);
            if (!next) setEditTarget(null);
          }}
          date={editTarget?.date_intervention ?? quickAddDate}
          creneau={editTarget ? null : quickAddCreneau}
          clients={clients}
          editIntervention={editTarget ?? undefined}
          onOptimiste={appliquerOptimiste}
        />
      )}

      <CouleurEvenementDialog
        cible={cibleDialogue}
        onClose={() => setCibleCouleur(null)}
      />

      <EvenementDetailSheet
        evenement={detail}
        onClose={() => setDetail(null)}
        style={styleDe}
        onModifier={openEdit}
        onRattacher={ouvrirRattacher}
        onOptimiste={appliquerOptimiste}
      />

      {rattacherMonte && (
        <RdvARattacherDialog
          open={rattacherOuvert}
          onOpenChange={setRattacherOuvert}
          rdvs={rdvARattacher}
          aujourdhui={todayYmd}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card className={tone === "warning" ? "border-amber-400" : undefined}>
      <CardContent className="p-3 sm:p-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
          {value}
        </div>
        {hint && (
          <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Legend({ couleurs }: { couleurs: AgendaCouleurs }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {CATEGORY_ORDER.map((cat) => (
        <LegendDot key={cat} couleur={couleurs[cat]} label={CATEGORY_LABELS[cat]} />
      ))}
    </div>
  );
}

function LegendDot({ couleur, label }: { couleur: string; label: string }) {
  return (
    <Badge variant="outline" className="gap-1.5 border-muted-foreground/20 font-normal">
      <span
        className="inline-block size-2.5 rounded-full border border-black/10 dark:border-white/20"
        style={{ backgroundColor: couleur }}
      />
      {label}
    </Badge>
  );
}
