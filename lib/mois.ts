/**
 * Arithmétique de mois PURE, sans mutation de Date.
 *
 * Raison d'être : `d.setMonth(d.getMonth() - 1)` sur un 31 du mois
 * déborde quand le mois cible a moins de jours (31 août − 1 mois →
 * « 31 juillet » ✓, mais − 2 mois → « 31 juin » → 1ᵉʳ juillet ✗).
 * Le graphe mensuel du dashboard a affiché des mois dupliqués et un
 * mois manquant chaque fin de mois à cause de ça. Ici on ne manipule
 * que des couples (année, mois).
 */

export type MoisBucket = {
  /** Libellé court FR : "août 26" */
  label: string;
  /** Premier jour du mois, inclusif (YYYY-MM-DD) */
  start: string;
  /** Premier jour du mois suivant, exclusif (YYYY-MM-DD) */
  end: string;
};

function ym(annee: number, mois0: number): { annee: number; mois0: number } {
  // Normalise un mois hors bornes (mois0 peut être négatif ou > 11)
  const total = annee * 12 + mois0;
  return { annee: Math.floor(total / 12), mois0: ((total % 12) + 12) % 12 };
}

function premierJour(annee: number, mois0: number): string {
  return `${annee}-${String(mois0 + 1).padStart(2, "0")}-01`;
}

function labelMois(annee: number, mois0: number): string {
  // Date construite à midi UTC le 1ᵉʳ : aucun risque de glissement
  return new Date(Date.UTC(annee, mois0, 1, 12))
    .toLocaleDateString("fr-FR", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    })
    .replace(".", "");
}

/**
 * Les 12 derniers mois glissants (du plus ancien au mois courant),
 * bornés [start inclusif, end exclusif]. Stable quel que soit le jour
 * du mois, 31 inclus.
 */
export function derniers12Mois(now: Date = new Date()): MoisBucket[] {
  const annee = now.getUTCFullYear();
  const mois0 = now.getUTCMonth();
  const buckets: MoisBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = ym(annee, mois0 - i);
    const fin = ym(m.annee, m.mois0 + 1);
    buckets.push({
      label: labelMois(m.annee, m.mois0),
      start: premierJour(m.annee, m.mois0),
      end: premierJour(fin.annee, fin.mois0),
    });
  }
  return buckets;
}

/**
 * Ajoute des mois à une date YYYY-MM-DD en BORNANT au dernier jour du
 * mois cible (31 août + 6 mois → 28/29 février, jamais le 3 mars).
 */
export function ajouterMois(dateIso: string, nbMois: number): string {
  const annee = Number(dateIso.slice(0, 4));
  const mois0 = Number(dateIso.slice(5, 7)) - 1;
  const jour = Number(dateIso.slice(8, 10));
  const cible = ym(annee, mois0 + nbMois);
  // Dernier jour du mois cible : jour 0 du mois suivant
  const dernierJour = new Date(
    Date.UTC(cible.annee, cible.mois0 + 1, 0),
  ).getUTCDate();
  const j = Math.min(jour, dernierJour);
  return `${cible.annee}-${String(cible.mois0 + 1).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}
