"use client";

import { Ban, Check } from "lucide-react";

import { PALETTE, normaliserCouleur, styleEvenement } from "@/lib/agenda-colors";
import { cn } from "@/lib/utils";

/**
 * Sélecteur de couleur : la palette proposée + un choix libre (le
 * sélecteur natif du navigateur / de l'iPhone). L'aperçu montre la
 * pastille telle qu'elle s'affichera dans l'agenda, avec le texte
 * automatiquement sombre ou clair selon le fond.
 */
export function SelecteurCouleur({
  valeur,
  onChange,
  nom,
  apercu = "Exemple d'évènement",
  auto,
}: {
  valeur: string;
  onChange: (hex: string) => void;
  /** Pour les libellés d'accessibilité (« Bleu pour Facture »). */
  nom: string;
  apercu?: string;
  /**
   * Option « couleur du type » (pas de couleur propre) : `actif` quand
   * c'est le choix courant, `onChoisir` pour y revenir.
   */
  auto?: { actif: boolean; onChoisir: () => void; couleurDuType: string };
}) {
  const hex = normaliserCouleur(valeur) ?? "#dbeafe";
  const affiche = auto?.actif ? (normaliserCouleur(auto.couleurDuType) ?? hex) : hex;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {auto && (
          <button
            type="button"
            onClick={auto.onChoisir}
            title="Couleur du type (par défaut)"
            aria-label={`Couleur du type pour ${nom}`}
            aria-pressed={auto.actif}
            style={{ backgroundColor: normaliserCouleur(auto.couleurDuType) ?? undefined }}
            className={cn(
              "flex size-7 items-center justify-center rounded-md border border-dashed transition-transform",
              auto.actif
                ? "border-foreground ring-2 ring-foreground/30 ring-offset-1 ring-offset-background"
                : "border-black/30 hover:scale-110 dark:border-white/30",
            )}
          >
            {auto.actif ? (
              <Check className="size-3.5" style={{ color: styleEvenement(affiche).color }} />
            ) : (
              <Ban className="size-3 opacity-50" />
            )}
          </button>
        )}
        {PALETTE.map((c) => {
          const actif = !auto?.actif && c.hex === hex;
          return (
            <button
              key={c.hex}
              type="button"
              onClick={() => onChange(c.hex)}
              title={c.label}
              aria-label={`${c.label} pour ${nom}`}
              aria-pressed={actif}
              style={{ backgroundColor: c.hex }}
              className={cn(
                "flex size-7 items-center justify-center rounded-md border transition-transform",
                actif
                  ? "border-foreground ring-2 ring-foreground/30 ring-offset-1 ring-offset-background"
                  : "border-black/10 hover:scale-110 dark:border-white/15",
              )}
            >
              {actif && (
                <Check className="size-3.5" style={{ color: styleEvenement(c.hex).color }} />
              )}
            </button>
          );
        })}
        <label
          className="ml-1 flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          title="Choisir une couleur libre"
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`Couleur libre pour ${nom}`}
            className="size-5 cursor-pointer border-0 bg-transparent p-0"
          />
          Autre…
        </label>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span
          className="inline-block max-w-56 truncate rounded px-1.5 py-0.5 text-[11px] leading-tight"
          style={styleEvenement(affiche)}
        >
          {apercu}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {auto?.actif ? "couleur du type" : hex}
        </span>
      </div>
    </div>
  );
}
