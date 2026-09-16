"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, AlertCircle, Plus } from "lucide-react";

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
  libelleJourLong,
  libelleSemaine,
  naviguer,
  vueInitiale,
  type VueAgenda,
} from "@/lib/agenda-vues";
import { EvenementDetailSheet } from "@/components/agenda/evenement-detail-sheet";
import { RdvARattacherDialog } from "@/components/agenda/rdv-a-rattacher-dialog";
import { VueGrilleHoraire } from "@/components/agenda/vue-grille-horaire";
import { VueListe } from "@/components/agenda/vue-liste";
import type { AgendaEvent, AgendaData } from "@/lib/actions/agenda";
import {
  QuickInterventionDialog,
  type ClientOption,
  type InterventionEditData,
} from "@/components/agenda/quick-intervention-dialog";

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
function eventCategorie(e: AgendaEvent): AgendaCategory | "annulee" {
  if (e.kind === "intervention") {
    return e.facture_emise ? "intervention_facturee" : "intervention_a_facturer";
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
): React.CSSProperties | undefined {
  const cat = eventCategorie(e);
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
}) {
  const router = useRouter();
  const { year, month, events, stats } = data;

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
    router.replace(`/agenda?vue=${v}&date=${date}`);
  };

  // Fiche d'un évènement (vues jour / semaine / liste)
  const [detail, setDetail] = useState<AgendaEvent | null>(null);
  // Liste des RDV iPhone à rattacher (bandeau cliquable)
  const [rattacherOuvert, setRattacherOuvert] = useState(false);

  // Couleur d'un évènement précis (dialogue)
  const [cibleCouleur, setCibleCouleur] = useState<AgendaEvent | null>(null);
  const cibleDialogue = useMemo(() => {
    if (!cibleCouleur) return null;
    const cat = eventCategorie(cibleCouleur);
    if (cat === "annulee") return null;
    const cle = cleEvenement(cibleCouleur);
    return {
      cle,
      libelle: eventShortLabel(cibleCouleur),
      couleurActuelle: couleurEvenement(cat, cle, couleurs, couleursEvenements),
      couleurDuType: couleurs[cat],
      aCouleurPropre: cle in couleursEvenements,
    };
  }, [cibleCouleur, couleurs, couleursEvenements]);

  const todayYmd = useMemo(() => toYmd(new Date()), []);

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
  const [editTarget, setEditTarget] = useState<InterventionEditData | null>(null);

  const openQuickAdd = (ymd: string) => {
    setEditTarget(null);
    setQuickAddDate(ymd);
    setQuickAddOpen(true);
  };

  const openEdit = (e: AgendaEvent) => {
    if (e.kind !== "intervention" || !e.client_id) return;
    setEditTarget({
      id: e.id,
      client_id: e.client_id,
      date_intervention: e.date_start,
      date_fin: e.date_end !== e.date_start ? e.date_end : null,
      heure_debut: e.heure_debut,
      heure_fin: e.heure_fin,
      type: e.type_activite ?? "installation",
      description: e.description,
    });
    setQuickAddOpen(true);
  };

  const allerA = (d: string) => {
    router.push(`/agenda?vue=${vue ?? "mois"}&date=${d}`);
  };
  const prevMonth = () => allerA(naviguer(vue ?? "mois", date, -1));
  const nextMonth = () => allerA(naviguer(vue ?? "mois", date, 1));
  const goToday = () => allerA(todayYmd);

  const titre =
    vue === "jour"
      ? libelleJourLong(date)
      : vue === "semaine"
        ? libelleSemaine(date)
        : vue === "liste"
          ? `${JOURS_LISTE} prochains jours`
          : `${MOIS_FR[month - 1]} ${year}`;

  const styleDe = (e: AgendaEvent) => eventStyle(e, couleurs, couleursEvenements);

  const inMonth = (e: AgendaEvent) => {
    const debutMois = `${year}-${String(month).padStart(2, "0")}-01`;
    const finMois = toYmd(new Date(year, month, 0));
    return e.date_end >= debutMois && e.date_start <= finMois;
  };
  const rdvARattacher = events.filter(
    (e) => e.kind === "external" && !e.facture_emise && inMonth(e),
  );

  return (
    <div className="space-y-4">
      {/* Stats du mois */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <StatCard
          label="À facturer"
          value={stats.nbInterventionsAFacturer + stats.nbExternalAFacturer}
          hint={
            stats.nbExternalAFacturer > 0
              ? `${stats.nbInterventionsAFacturer} intervention(s) + ${stats.nbExternalAFacturer} RDV iPhone`
              : `${stats.nbInterventions} intervention(s) ce mois`
          }
          tone={
            stats.nbInterventionsAFacturer + stats.nbExternalAFacturer > 0
              ? "warning"
              : "default"
          }
        />
        <StatCard
          label="Factures"
          value={stats.nbFactures}
          hint="prestations facturées"
        />
        <StatCard label="Devis planifiés" value={stats.nbDevis} hint="travaux prévus" />
        <StatCard label="Visites maint." value={stats.nbVisites} hint="contrats" />
      </div>

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
          <Button
            size="sm"
            onClick={() => openQuickAdd(todayYmd)}
            className="sm:hidden"
          >
            <Plus className="size-4" />
          </Button>
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
          <div className={cn(vue !== "mois" && "max-sm:hidden")}>
            <Legend couleurs={couleurs} />
          </div>
        </div>
      </div>

      {/* Erreur calendrier externe */}
      {data.externalCalendarError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          ⚠︎ Impossible de récupérer votre calendrier téléphone :{" "}
          {data.externalCalendarError}
        </div>
      )}

      {/* Alerte : choses à facturer (interventions + RDV iPhone importés) */}
      {stats.nbInterventionsAFacturer + stats.nbExternalAFacturer > 0 && (
        <div
          role={stats.nbExternalAFacturer > 0 ? "button" : undefined}
          tabIndex={stats.nbExternalAFacturer > 0 ? 0 : undefined}
          onClick={() => stats.nbExternalAFacturer > 0 && setRattacherOuvert(true)}
          onKeyDown={(ev) => {
            if (stats.nbExternalAFacturer > 0 && (ev.key === "Enter" || ev.key === " ")) {
              ev.preventDefault();
              setRattacherOuvert(true);
            }
          }}
          className={cn(
            "flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
            stats.nbExternalAFacturer > 0 &&
              "cursor-pointer transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-amber-950/60",
          )}
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1 space-y-1">
            {stats.nbInterventionsAFacturer > 0 && (
              <p className="font-medium">
                {stats.nbInterventionsAFacturer} intervention
                {stats.nbInterventionsAFacturer > 1 ? "s" : ""} de ce mois
                {stats.nbInterventionsAFacturer > 1 ? " ne sont " : " n'est "}
                pas encore facturée
                {stats.nbInterventionsAFacturer > 1 ? "s" : ""}.
              </p>
            )}
            {stats.nbExternalAFacturer > 0 && (
              <p className="font-medium">
                {stats.nbExternalAFacturer} RDV noté
                {stats.nbExternalAFacturer > 1 ? "s" : ""} sur votre iPhone
                ce mois — pensez à les rattacher à une facture (section
                « Évènements couverts » sur la fiche facture).
              </p>
            )}
            <p className="text-xs opacity-80">
              Repérables à leur couleur « À facturer » dans le calendrier
              ci-dessous (préfixe ⚠︎📱 pour les RDV iPhone ; ✓📱 = déjà
              facturés).
              {stats.nbExternalAFacturer > 0 && (
                <strong className="ml-1">Cliquez pour les rattacher.</strong>
              )}
            </p>
          </div>
          {stats.nbExternalAFacturer > 0 && (
            <ChevronRight className="mt-0.5 size-4 shrink-0 opacity-70" />
          )}
        </div>
      )}

      {/* Vues jour / semaine / liste ; le mois garde sa grille ci-dessous. */}
      {vue === null && (
        <div className="h-64 animate-pulse rounded-lg border bg-muted/30" aria-hidden="true" />
      )}
      {(vue === "jour" || vue === "semaine") && (
        <VueGrilleHoraire
          mode={vue}
          date={date}
          aujourdhui={todayYmd}
          events={events}
          holidays={holidays}
          style={styleDe}
          onOuvrir={setDetail}
          onPlanifier={openQuickAdd}
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
                  onClick={() => openQuickAdd(ymd)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      openQuickAdd(ymd);
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
                      const styleEv = eventStyle(e, couleurs, couleursEvenements);
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
                        return envelopper(
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openEdit(e);
                            }}
                            className={commonClass}
                            style={styleEv}
                            title={tooltip}
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

      <p className="text-xs text-muted-foreground">
        Cliquez sur une case du calendrier pour planifier une intervention,
        ou sur un évènement existant pour ouvrir sa fiche. Tout ce qui est
        en{" "}
        <span
          className="inline-block size-2.5 rounded-full align-middle"
          style={styleEvenement(couleurs.intervention_a_facturer)}
          aria-hidden="true"
        />{" "}
        <span className="font-medium">⚠︎</span> est <strong>à facturer</strong> — interventions sans facture
        associée ou RDV notés sur l'iPhone (préfixe 📱).
      </p>

      <QuickInterventionDialog
        open={quickAddOpen}
        onOpenChange={(next) => {
          setQuickAddOpen(next);
          if (!next) setEditTarget(null);
        }}
        date={editTarget?.date_intervention ?? quickAddDate}
        clients={clients}
        editIntervention={editTarget ?? undefined}
      />

      <CouleurEvenementDialog
        cible={cibleDialogue}
        onClose={() => setCibleCouleur(null)}
      />

      <EvenementDetailSheet
        evenement={detail}
        onClose={() => setDetail(null)}
        style={styleDe}
        onModifier={openEdit}
        onRattacher={() => setRattacherOuvert(true)}
      />

      <RdvARattacherDialog
        open={rattacherOuvert}
        onOpenChange={setRattacherOuvert}
        rdvs={rdvARattacher}
        aujourdhui={todayYmd}
      />
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
