"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";

import type { AgendaEvent } from "@/lib/actions/agenda";
import {
  HEURE_DEBUT_GRILLE,
  HEURE_FIN_GRILLE,
  creneauDepuisHeures,
  creneauxDuJour,
  heureCourte,
  horodatesDuJour,
  journeeEntiere,
  joursSemaine,
  libelleJour,
  libelleJourCourt,
} from "@/lib/agenda-vues";
import { cn } from "@/lib/utils";
import { libelleEvenement } from "@/components/agenda/evenement-commun";

const HEURES = Array.from(
  { length: HEURE_FIN_GRILLE - HEURE_DEBUT_GRILLE },
  (_, i) => HEURE_DEBUT_GRILLE + i,
);

/**
 * Grille horaire partagée par les vues JOUR (une colonne, créneaux
 * larges pour le doigt) et SEMAINE (lundi → samedi, dimanche
 * repliable : c'est la vue « créneaux libres » quand un client appelle).
 * Les évènements sans heure vont dans le bandeau « Journée » en haut ;
 * les horodatés sont posés sur la grille 7h → 20h d'après leurs heures.
 * Un clic sur une ligne vide planifie une intervention ce jour-là À
 * CETTE HEURE (14 h → 14:00–15:00) ; un clic-glisser sur plusieurs
 * lignes donne la plage (14 h → 16 h). Sur téléphone, un tap suffit ;
 * le défilement vertical reste au navigateur (touch-action: pan-y).
 */
export function VueGrilleHoraire({
  mode,
  date,
  aujourdhui,
  events,
  holidays,
  style,
  onOuvrir,
  onPlanifier,
}: {
  mode: "jour" | "semaine";
  date: string;
  aujourdhui: string;
  events: AgendaEvent[];
  holidays: Record<string, string>;
  style: (e: AgendaEvent) => React.CSSProperties | undefined;
  onOuvrir: (e: AgendaEvent) => void;
  /**
   * Planifier une intervention : le jour, et — depuis la grille — les
   * heures de début et de fin (exclusive) du créneau cliqué ou glissé.
   */
  onPlanifier: (ymd: string, heures?: { debut: number; fin: number }) => void;
}) {
  const [dimanche, setDimanche] = useState(false);
  const jours =
    mode === "jour" ? [date] : joursSemaine(date).slice(0, dimanche ? 7 : 6);
  const hauteurHeure = mode === "jour" ? 64 : 48; // px

  // Sélection en cours sur la grille (clic ou clic-glisser) : jour,
  // ligne de départ et ligne sous le pointeur. Relâcher planifie.
  const [selection, setSelection] = useState<{
    jour: string;
    debut: number;
    fin: number;
  } | null>(null);
  // Point de départ du pointeur : un mouvement surtout horizontal est un
  // swipe (changer de jour / de semaine), pas une sélection de créneau.
  const origine = useRef<{ x: number; y: number } | null>(null);

  const heureSousPointeur = (ev: React.PointerEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const i = Math.floor((ev.clientY - rect.top) / hauteurHeure);
    return HEURE_DEBUT_GRILLE + Math.max(0, Math.min(HEURES.length - 1, i));
  };

  const debutSelection = (jour: string) => (ev: React.PointerEvent<HTMLDivElement>) => {
    // Bouton principal seulement, et jamais depuis un créneau existant
    // (qui a son propre clic → fiche).
    if (ev.button !== 0) return;
    if ((ev.target as HTMLElement).closest("[data-evenement]")) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    origine.current = { x: ev.clientX, y: ev.clientY };
    const h = heureSousPointeur(ev);
    setSelection({ jour, debut: h, fin: h });
  };

  const etendreSelection = (jour: string) => (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!selection || selection.jour !== jour) return;
    const o = origine.current;
    if (o) {
      const dx = Math.abs(ev.clientX - o.x);
      const dy = Math.abs(ev.clientY - o.y);
      if (dx > 24 && dx > dy) {
        // Swipe horizontal : on abandonne la sélection, le conteneur
        // gère le changement de jour / semaine.
        setSelection(null);
        if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
          ev.currentTarget.releasePointerCapture(ev.pointerId);
        }
        return;
      }
    }
    const h = heureSousPointeur(ev);
    if (h !== selection.fin) setSelection({ ...selection, fin: h });
  };

  const finirSelection = (jour: string) => (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!selection || selection.jour !== jour) return;
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    }
    const debut = Math.min(selection.debut, selection.fin);
    const fin = Math.max(selection.debut, selection.fin) + 1; // fin exclusive
    setSelection(null);
    onPlanifier(jour, { debut, fin });
  };

  const annulerSelection = () => setSelection(null);

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* En-tête des jours (semaine) + bandeau journée entière */}
      <div
        className="grid border-b"
        style={{ gridTemplateColumns: `3rem repeat(${jours.length}, minmax(0, 1fr))` }}
      >
        <div className="border-r px-1 py-1 text-[10px] uppercase text-muted-foreground">
          {mode === "semaine" && (
            <button
              type="button"
              onClick={() => setDimanche((v) => !v)}
              className="text-[10px] underline-offset-2 hover:underline"
              title={dimanche ? "Masquer le dimanche" : "Afficher le dimanche"}
            >
              {dimanche ? "− dim." : "+ dim."}
            </button>
          )}
        </div>
        {jours.map((jour) => {
          const entiers = journeeEntiere(events, jour);
          const ferie = holidays[jour];
          return (
            <div key={jour} className="min-w-0 border-r px-1 py-1 last:border-r-0">
              {mode === "semaine" && (
                <div
                  className={cn(
                    "truncate text-center text-xs font-medium",
                    jour === aujourdhui && "text-primary",
                    ferie && "text-muted-foreground",
                  )}
                  title={ferie}
                >
                  <span className="sm:hidden">{libelleJourCourt(jour)}</span>
                  <span className="hidden sm:inline">{libelleJour(jour)}</span>
                </div>
              )}
              {ferie && (
                <div className="truncate text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                  {ferie}
                </div>
              )}
              <div className="mt-1 space-y-0.5">
                {entiers.map((e) => (
                  <button
                    key={`${e.kind}-${e.id}`}
                    type="button"
                    onClick={() => onOuvrir(e)}
                    style={style(e)}
                    className={cn(
                      "block w-full truncate rounded px-1.5 text-left text-[11px] leading-6 ring-1 ring-inset ring-black/10 hover:brightness-95 dark:ring-white/20 dark:hover:brightness-110",
                      mode === "jour" && "text-sm leading-8",
                    )}
                  >
                    {libelleEvenement(e)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grille horaire */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `3rem repeat(${jours.length}, minmax(0, 1fr))` }}
      >
        {/* Colonne des heures */}
        <div className="relative border-r" style={{ height: HEURES.length * hauteurHeure }}>
          {HEURES.map((h, i) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ top: i * hauteurHeure }}
            >
              {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
            </div>
          ))}
        </div>
        {jours.map((jour) => {
          const creneaux = creneauxDuJour(horodatesDuJour(events, jour));
          const sel = selection?.jour === jour ? selection : null;
          const selDebut = sel ? Math.min(sel.debut, sel.fin) : 0;
          const selFin = sel ? Math.max(sel.debut, sel.fin) + 1 : 0;
          return (
            <div
              key={jour}
              data-jour={jour}
              className={cn(
                "relative select-none border-r last:border-r-0",
                jour === aujourdhui && "bg-primary/[0.03]",
                holidays[jour] && "bg-muted/40",
              )}
              style={{ height: HEURES.length * hauteurHeure, touchAction: "pan-y" }}
              onPointerDown={debutSelection(jour)}
              onPointerMove={etendreSelection(jour)}
              onPointerUp={finirSelection(jour)}
              onPointerCancel={annulerSelection}
            >
              {/* Lignes d'heures : cliquer (ou glisser) planifie à cette heure */}
              {HEURES.map((h, i) => (
                <div
                  key={h}
                  data-heure={h}
                  title={`Planifier le ${libelleJour(jour)} à ${h} h`}
                  className="group absolute inset-x-0 cursor-pointer border-t border-border/60 hover:bg-accent/40"
                  style={{ top: i * hauteurHeure, height: hauteurHeure }}
                >
                  <Plus className="absolute right-1 top-1 size-3 text-primary opacity-0 group-hover:opacity-60" />
                </div>
              ))}
              {/* Sélection en cours (clic-glisser) */}
              {sel && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md bg-primary/15 ring-1 ring-inset ring-primary"
                  style={{
                    top: (selDebut - HEURE_DEBUT_GRILLE) * hauteurHeure,
                    height: (selFin - selDebut) * hauteurHeure,
                  }}
                >
                  <span className="absolute left-1 top-0.5 text-[11px] font-medium text-primary">
                    {creneauDepuisHeures(selDebut, selFin).heure_debut}–
                    {creneauDepuisHeures(selDebut, selFin).heure_fin}
                  </span>
                </div>
              )}
              {/* Créneaux */}
              {creneaux.map(({ evenement: e, creneau }) => {
                const largeur = 100 / creneau.colonnes;
                return (
                  <button
                    key={`${e.kind}-${e.id}`}
                    type="button"
                    data-evenement=""
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOuvrir(e);
                    }}
                    style={{
                      ...style(e),
                      top: `${creneau.top}%`,
                      height: `${creneau.height}%`,
                      left: `calc(${creneau.colonne * largeur}% + 2px)`,
                      width: `calc(${largeur}% - 4px)`,
                    }}
                    className={cn(
                      "absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left ring-1 ring-inset ring-black/10 hover:brightness-95 dark:ring-white/20 dark:hover:brightness-110",
                      mode === "jour" ? "text-sm" : "text-[11px] leading-tight",
                    )}
                    title={libelleEvenement(e)}
                  >
                    <span className="block truncate font-medium">
                      {heureCourte(e.heure_debut)}
                      {e.heure_fin ? `–${heureCourte(e.heure_fin)}` : ""}
                    </span>
                    <span className="block truncate">{libelleEvenement(e)}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
