"use client";

import { joursSemaine, libelleJourCourt } from "@/lib/agenda-vues";
import { cn } from "@/lib/utils";
import { useGlissement } from "@/components/agenda/use-glissement";

const LETTRES = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Bandeau des 7 jours de la semaine (lundi → dimanche), façon agenda de
 * téléphone : le jour affiché est en plein, aujourd'hui est cerclé, un
 * point marque les jours qui ont au moins un évènement. Un tap change
 * de jour ; un swipe sur le bandeau change de semaine. Un rendez-vous
 * glissé depuis la grille peut y être déposé (data-jour) : il passe à
 * ce jour en gardant ses heures.
 */
export function BandeauJours({
  date,
  aujourdhui,
  joursCharges,
  onChoisir,
  onSemaine,
  jourCible = null,
}: {
  date: string;
  aujourdhui: string;
  joursCharges: Set<string>;
  onChoisir: (ymd: string) => void;
  onSemaine: (sens: 1 | -1) => void;
  /** Jour survolé par un rendez-vous glissé (on peut y déposer : le jour change, l'heure reste). */
  jourCible?: string | null;
}) {
  const jours = joursSemaine(date);
  const glissement = useGlissement(onSemaine);

  return (
    <div
      role="tablist"
      aria-label="Jours de la semaine"
      className="grid grid-cols-7 gap-1 rounded-lg border bg-card px-1 py-1.5 touch-pan-y"
      {...glissement}
    >
      {jours.map((jour, i) => {
        const actif = jour === date;
        const cestAujourdhui = jour === aujourdhui;
        return (
          <button
            key={jour}
            type="button"
            role="tab"
            aria-selected={actif}
            aria-label={libelleJourCourt(jour)}
            data-jour={jour}
            onClick={() => onChoisir(jour)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md text-xs text-muted-foreground transition-colors active:bg-accent/60",
              jourCible === jour && "bg-primary/15 ring-2 ring-inset ring-primary",
            )}
          >
            <span className={cn(i >= 5 && "font-semibold")}>{LETTRES[i]}</span>
            <span
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-full text-sm font-medium tabular-nums text-foreground",
                actif && "bg-primary text-primary-foreground",
                !actif && cestAujourdhui && "ring-2 ring-primary",
              )}
            >
              {Number(jour.slice(8, 10))}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                joursCharges.has(jour) ? (actif ? "bg-primary" : "bg-primary/70") : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
