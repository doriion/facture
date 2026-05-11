"use client";

/**
 * Indicateur visuel de durée (en jours, incluse) calculée à partir d'une
 * date de début et d'une date de fin optionnelle. Utilisé dans les
 * formulaires intervention/facture/devis pour rendre la plage choisie
 * lisible en un coup d'œil.
 */

export function computeDureeJours(
  start: string | undefined,
  end: string | undefined,
): number | null {
  if (!start) return null;
  if (!end || end === "") return 1;
  const ds = Date.parse(start + "T00:00:00Z");
  const de = Date.parse(end + "T00:00:00Z");
  if (Number.isNaN(ds) || Number.isNaN(de) || de < ds) return null;
  return Math.round((de - ds) / 86400000) + 1;
}

export function DureeBadge({ jours }: { jours: number | null }) {
  if (jours === null) return null;
  const isMulti = jours > 1;
  return (
    <div
      className={
        isMulti
          ? "inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          : "inline-flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
      }
    >
      <span aria-hidden="true">📅</span>
      Durée sélectionnée :{" "}
      <strong className="tabular-nums">{jours}</strong>{" "}
      {jours > 1 ? "jours" : "jour"}
    </div>
  );
}
