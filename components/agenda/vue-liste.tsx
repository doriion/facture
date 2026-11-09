"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarPlus, ListTodo, MapPin, Navigation, Phone, Receipt, Search, X } from "lucide-react";

import type { AFacturerItem, AgendaEvent } from "@/lib/actions/agenda";
import type { TacheDuJour } from "@/lib/actions/taches";
import { contactEvenement, lienItineraireJournee } from "@/lib/agenda-contact";
import { grouperParJour, heureCourte, libelleJour } from "@/lib/agenda-vues";
import { formatDateFr } from "@/lib/format";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatutEvenementBadge, libelleEvenement } from "@/components/agenda/evenement-commun";

const MAX_A_FACTURER = 4;

/**
 * Vue LISTE = « À faire » : d'un coup d'œil, tout ce qui attend.
 * D'abord AUJOURD'HUI (toujours affiché, même vide) avec ses
 * rendez-vous et les tâches du jour ou en retard ; puis « À facturer »
 * (interventions passées sans facture) ; puis les prochains jours à la
 * suite (« Demain », « Jeudi 18 sept. »). Chaque ligne : heure, titre,
 * client, lieu, statut. Pensée pour le pouce : lignes hautes, gros
 * texte, une seule colonne, recherche repliée derrière une loupe.
 */
/**
 * Une ligne d'évènement (heure, barre de couleur, titre, adresse,
 * statut, téléphone). Partagée par la vue Liste et la liste du jour
 * sous la grille du mois sur mobile.
 */
export function LigneEvenement({
  e,
  style,
  onOuvrir,
}: {
  e: AgendaEvent;
  style: (e: AgendaEvent) => React.CSSProperties | undefined;
  onOuvrir: (e: AgendaEvent) => void;
}) {
  const contact = contactEvenement(e);
  const debut = heureCourte(e.heure_debut);
  const fin = heureCourte(e.heure_fin);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOuvrir(e)}
        className="flex w-full items-stretch gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/40 active:bg-accent/60"
      >
        {/* Heure : colonne fixe, gros et lisible */}
        <div className="w-14 shrink-0 pt-0.5 text-sm tabular-nums">
          {debut ? (
            <>
              <div className="font-semibold">{debut}</div>
              {fin && <div className="text-xs text-muted-foreground">{fin}</div>}
            </>
          ) : (
            <div className="text-xs leading-tight text-muted-foreground">Journée</div>
          )}
        </div>
        {/* Barre de couleur du type / de l'évènement */}
        <span
          className="w-1.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/20"
          style={style(e)}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium leading-snug">{libelleEvenement(e)}</p>
          {e.client_nom && e.kind !== "intervention" && (
            <p className="truncate text-sm text-muted-foreground">{e.client_nom}</p>
          )}
          {contact.adresse && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{contact.adresse}</span>
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatutEvenementBadge e={e} />
            {contact.telephone && (
              <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                <Phone className="size-3" />
                {contact.telephone}
              </Badge>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

export function VueListe({
  events,
  aujourdhui,
  nbJours,
  style,
  onOuvrir,
  onPlanifier,
  taches = [],
  aFacturer = [],
  nbExternalAFacturer = 0,
  onVoirAFacturer,
}: {
  events: AgendaEvent[];
  aujourdhui: string;
  nbJours: number;
  style: (e: AgendaEvent) => React.CSSProperties | undefined;
  onOuvrir: (e: AgendaEvent) => void;
  onPlanifier: (ymd: string) => void;
  /** Tâches échues aujourd'hui et en retard. */
  taches?: TacheDuJour[];
  /** Interventions passées sans facture (tous mois). */
  aFacturer?: AFacturerItem[];
  /** RDV iPhone à rattacher à une facture. */
  nbExternalAFacturer?: number;
  /** Ouvre la liste complète « à facturer » (feuille du bas sur téléphone). */
  onVoirAFacturer?: () => void;
}) {
  // Recherche : client, titre, lieu — filtre les évènements à venir
  // avant regroupement par jour (pas de casse ni d'accents). Repliée
  // derrière une loupe pour laisser la place à « Aujourd'hui ».
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [recherche, setRecherche] = useState("");
  const q = rechercheOuverte ? normaliserRecherche(recherche) : "";
  const filtres = q
    ? events.filter((e) => normaliserRecherche(texteRecherche(e)).includes(q))
    : events;
  const groupes = grouperParJour(filtres, aujourdhui, nbJours);
  const duJour = groupes.find((g) => g.jour === aujourdhui)?.evenements ?? [];
  const aVenir = groupes.filter((g) => g.jour !== aujourdhui);
  const nbAFacturer = aFacturer.length + nbExternalAFacturer;
  const tachesEnRetard = taches.filter((t) => t.joursRetard > 0).length;
  // Itinéraire de la journée : toutes les adresses des RDV du jour, dans l'ordre.
  const adressesDuJour = duJour.map((e) => contactEvenement(e).adresse).filter((a): a is string => Boolean(a));
  const itineraireJour = adressesDuJour.length >= 2 ? lienItineraireJournee(adressesDuJour) : null;

  const barre = (
    <div className="flex items-center gap-2">
      {rechercheOuverte ? (
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            autoFocus
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un client, un rendez-vous…"
            aria-label="Rechercher dans les rendez-vous à venir"
            className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-9 sm:text-sm"
          />
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Puce>{duJour.length} RDV aujourd&apos;hui</Puce>
          {taches.length > 0 && <Puce ton={tachesEnRetard > 0 ? "alerte" : "neutre"}>{taches.length} tâche{taches.length > 1 ? "s" : ""}{tachesEnRetard > 0 ? ` (${tachesEnRetard} en retard)` : ""}</Puce>}
          {nbAFacturer > 0 && <Puce ton="alerte">{nbAFacturer} à facturer</Puce>}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={rechercheOuverte ? "Fermer la recherche" : "Rechercher"}
        onClick={() => {
          setRechercheOuverte((v) => !v);
          setRecherche("");
        }}
      >
        {rechercheOuverte ? <X className="size-4" /> : <Search className="size-4" />}
      </Button>
    </div>
  );

  if (q && groupes.length === 0) {
    return (
      <div className="space-y-3">
        {barre}
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Aucun rendez-vous à venir ne correspond à « {recherche} ».
        </p>
      </div>
    );
  }
  if (q) {
    return (
      <div className="space-y-5">
        {barre}
        {groupes.map((g) => (
          <Jour key={g.jour} jour={g.jour} aujourdhui={aujourdhui} evenements={g.evenements} style={style} onOuvrir={onOuvrir} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {barre}

      {/* AUJOURD'HUI — toujours là, même vide : c'est la question du matin. */}
      <section>
        <h3 className="mb-1.5 flex items-center justify-between gap-2 text-base font-bold text-primary">
          <span>
            Aujourd&apos;hui <span className="ml-1 text-xs font-normal text-muted-foreground">{libelleJour(aujourdhui)}</span>
          </span>
          {itineraireJour && (
            <Button asChild size="sm" variant="outline" className="h-8">
              <a href={itineraireJour} target="_blank" rel="noopener">
                <Navigation className="size-3.5" />
                Itinéraire du jour ({adressesDuJour.length})
              </a>
            </Button>
          )}
        </h3>
        {duJour.length > 0 ? (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {duJour.map((e) => (
              <LigneEvenement key={`${e.kind}-${e.id}`} e={e} style={style} onOuvrir={onOuvrir} />
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">
            <span>Aucun rendez-vous aujourd&apos;hui.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => onPlanifier(aujourdhui)}>
              <CalendarPlus className="size-4" />
              Planifier
            </Button>
          </div>
        )}
        {taches.length > 0 && (
          <ul className="mt-2 divide-y overflow-hidden rounded-lg border bg-card">
            {taches.map((t) => (
              <li key={t.id}>
                <Link href="/taches" className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm hover:bg-accent/40">
                  <ListTodo className={cn("size-4 shrink-0", t.joursRetard > 0 ? "text-destructive" : "text-primary")} />
                  <span className="min-w-0 flex-1 truncate">
                    {t.titre}
                    {t.heure ? <span className="text-muted-foreground"> — {t.heure}</span> : null}
                  </span>
                  {t.joursRetard > 0 ? (
                    <Badge variant="destructive" className="shrink-0 font-normal">
                      {t.joursRetard} j de retard
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">
                      tâche
                    </Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* À FACTURER — l'argent qui attend. */}
      {nbAFacturer > 0 && (
        <section>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-base font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4" />
            À facturer
            <span className="text-xs font-normal text-muted-foreground">{nbAFacturer}</span>
          </h3>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {aFacturer.slice(0, MAX_A_FACTURER).map((it) => (
              <li key={it.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <Link href={`/interventions/${it.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-medium">
                    {it.description || LABELS_TYPE_INTERVENTION[it.type as keyof typeof LABELS_TYPE_INTERVENTION] || it.type}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDateFr(it.date_intervention)}
                    {it.client_nom ? ` · ${it.client_nom}` : ""}
                  </span>
                </Link>
                <Button asChild size="sm">
                  <Link href={`/interventions/${it.id}/cloture`}>
                    <Receipt className="size-3.5" />
                    Clôturer
                  </Link>
                </Button>
              </li>
            ))}
            {(aFacturer.length > MAX_A_FACTURER || nbExternalAFacturer > 0) && onVoirAFacturer && (
              <li>
                <button type="button" onClick={onVoirAFacturer} className="flex min-h-11 w-full items-center px-3 text-sm text-primary hover:underline">
                  Voir tout{aFacturer.length > MAX_A_FACTURER ? ` (+ ${aFacturer.length - MAX_A_FACTURER})` : ""}
                  {nbExternalAFacturer > 0 ? ` · ${nbExternalAFacturer} RDV iPhone à rattacher` : ""}
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* PROCHAINS JOURS */}
      {aVenir.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Rien d&apos;autre dans les {nbJours} prochains jours.
        </p>
      ) : (
        aVenir.map((g) => <Jour key={g.jour} jour={g.jour} aujourdhui={aujourdhui} evenements={g.evenements} style={style} onOuvrir={onOuvrir} />)
      )}
    </div>
  );
}

function Puce({ children, ton = "neutre" }: { children: React.ReactNode; ton?: "neutre" | "alerte" }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 font-medium",
        ton === "alerte" ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100" : "bg-muted/40 text-foreground",
      )}
    >
      {children}
    </span>
  );
}

function Jour({
  jour,
  aujourdhui,
  evenements,
  style,
  onOuvrir,
}: {
  jour: string;
  aujourdhui: string;
  evenements: AgendaEvent[];
  style: (e: AgendaEvent) => React.CSSProperties | undefined;
  onOuvrir: (e: AgendaEvent) => void;
}) {
  return (
    <section>
      <h3
        className={cn(
          "sticky top-0 z-10 -mx-1 mb-1.5 bg-background/95 px-1 py-1 text-sm font-semibold backdrop-blur",
          jour === aujourdhui && "text-primary",
        )}
      >
        {libelleJour(jour, aujourdhui)}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {evenements.length} évènement{evenements.length > 1 ? "s" : ""}
        </span>
      </h3>
      <ul className="divide-y overflow-hidden rounded-lg border bg-card">
        {evenements.map((e) => (
          <LigneEvenement key={`${e.kind}-${e.id}-${jour}`} e={e} style={style} onOuvrir={onOuvrir} />
        ))}
      </ul>
    </section>
  );
}

function normaliserRecherche(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function texteRecherche(e: AgendaEvent): string {
  const c = contactEvenement(e);
  return [e.title, e.client_nom, e.description, c.adresse, c.telephone]
    .filter(Boolean)
    .join(" ");
}
