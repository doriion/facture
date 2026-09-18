"use client";

import { useState } from "react";
import { MapPin, Phone, Search } from "lucide-react";

import type { AgendaEvent } from "@/lib/actions/agenda";
import { contactEvenement } from "@/lib/agenda-contact";
import { grouperParJour, heureCourte, libelleJour } from "@/lib/agenda-vues";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { StatutEvenementBadge, libelleEvenement } from "@/components/agenda/evenement-commun";

/**
 * Vue LISTE : les prochains rendez-vous à la suite, groupés par jour
 * (« Aujourd'hui », « Demain », « Jeudi 18 sept. »), les plus proches
 * en premier. Chaque ligne : heure, titre, client, lieu, statut.
 * Pensée pour le pouce : lignes hautes, gros texte, une seule colonne.
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
}: {
  events: AgendaEvent[];
  aujourdhui: string;
  nbJours: number;
  style: (e: AgendaEvent) => React.CSSProperties | undefined;
  onOuvrir: (e: AgendaEvent) => void;
  onPlanifier: (ymd: string) => void;
}) {
  // Recherche : client, titre, lieu — filtre les évènements à venir
  // avant regroupement par jour (pas de casse ni d'accents).
  const [recherche, setRecherche] = useState("");
  const q = normaliserRecherche(recherche);
  const filtres = q
    ? events.filter((e) => normaliserRecherche(texteRecherche(e)).includes(q))
    : events;
  const groupes = grouperParJour(filtres, aujourdhui, nbJours);

  const champRecherche = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Rechercher un client, un rendez-vous…"
        aria-label="Rechercher dans les rendez-vous à venir"
        className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-9 sm:text-sm"
      />
    </div>
  );

  if (groupes.length === 0 && q) {
    return (
      <div className="space-y-3">
        {champRecherche}
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Aucun rendez-vous à venir ne correspond à « {recherche} ».
        </p>
      </div>
    );
  }

  if (groupes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
        Rien de prévu dans les {nbJours} prochains jours.
        <button
          type="button"
          onClick={() => onPlanifier(aujourdhui)}
          className="mt-3 block w-full text-primary underline-offset-4 hover:underline"
        >
          Planifier une intervention
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {champRecherche}
      {groupes.map(({ jour, evenements }) => (
        <section key={jour}>
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
      ))}
    </div>
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
