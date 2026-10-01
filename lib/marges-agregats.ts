/**
 * Marges par chantier (facture) et par mois — logique PURE, testée.
 *
 * Même règle que lib/marges.ts : une ligne sans prix d'achat n'a pas
 * de coût (rien n'est inventé) ; elle est comptée dans `nbLignesSansPa`
 * pour que l'affichage rappelle que la marge est alors surestimée.
 * Factures annulées et brouillons exclus (pas de chantier réalisé),
 * avoirs en négatif (ils reprennent de la vente).
 */

import { margeReelle, totauxMarges, type LigneMargeable } from "@/lib/marges";

export type LigneMargeFacture = LigneMargeable & {
  facture: {
    id: string;
    numero: string;
    date_emission: string;
    statut: string;
    type_facture: string | null;
    total_ht: number;
    client: { nom: string } | null;
  } | null;
};

export type MargeChantier = {
  id: string;
  numero: string;
  date_emission: string;
  client_nom: string | null;
  avoir: boolean;
  totalHt: number;
  coutRenseigne: number;
  margeEuros: number;
  margePct: number | null;
  nbLignesSansPa: number;
};

export type MargeMois = {
  /** YYYY-MM */
  mois: string;
  nbFactures: number;
  totalHt: number;
  coutRenseigne: number;
  margeEuros: number;
  margePct: number | null;
  nbLignesSansPa: number;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Une entrée par facture émise (hors annulées et brouillons), la plus récente d'abord. */
export function margesParChantier(lignes: LigneMargeFacture[]): MargeChantier[] {
  const parFacture = new Map<string, { facture: NonNullable<LigneMargeFacture["facture"]>; lignes: LigneMargeable[] }>();
  for (const l of lignes) {
    const f = l.facture;
    if (!f || f.statut === "annulee" || f.statut === "brouillon") continue;
    const entree = parFacture.get(f.id) ?? { facture: f, lignes: [] };
    entree.lignes.push(l);
    parFacture.set(f.id, entree);
  }
  return Array.from(parFacture.values())
    .map(({ facture, lignes }) => {
      const avoir = facture.type_facture === "avoir";
      const signe = avoir ? -1 : 1;
      const t = totauxMarges(lignes);
      const r = margeReelle(Number(facture.total_ht), t.coutTotal);
      return {
        id: facture.id,
        numero: facture.numero,
        date_emission: facture.date_emission,
        client_nom: facture.client?.nom ?? null,
        avoir,
        totalHt: signe * r.totalHt,
        coutRenseigne: signe * r.coutRenseigne,
        margeEuros: signe * r.margeEuros,
        margePct: r.margePct,
        nbLignesSansPa: t.nbLignesSansPa,
      };
    })
    .sort((a, b) => (a.date_emission < b.date_emission ? 1 : a.date_emission > b.date_emission ? -1 : a.numero < b.numero ? 1 : -1));
}

/** Total par mois d'émission, le plus récent d'abord. */
export function margesParMois(chantiers: MargeChantier[]): MargeMois[] {
  const parMois = new Map<string, MargeMois>();
  for (const c of chantiers) {
    const mois = c.date_emission.slice(0, 7);
    const m = parMois.get(mois) ?? {
      mois,
      nbFactures: 0,
      totalHt: 0,
      coutRenseigne: 0,
      margeEuros: 0,
      margePct: null,
      nbLignesSansPa: 0,
    };
    m.nbFactures += 1;
    m.totalHt += c.totalHt;
    m.coutRenseigne += c.coutRenseigne;
    m.margeEuros += c.margeEuros;
    m.nbLignesSansPa += c.nbLignesSansPa;
    parMois.set(mois, m);
  }
  return Array.from(parMois.values())
    .map((m) => ({
      ...m,
      totalHt: arrondi(m.totalHt),
      coutRenseigne: arrondi(m.coutRenseigne),
      margeEuros: arrondi(m.margeEuros),
      margePct: m.totalHt === 0 ? null : arrondi((m.margeEuros / m.totalHt) * 100),
    }))
    .sort((a, b) => (a.mois < b.mois ? 1 : -1));
}

/** Total de l'année (somme des mois). */
export function totalMarges(mois: MargeMois[]): Omit<MargeMois, "mois"> {
  const t = mois.reduce(
    (acc, m) => ({
      nbFactures: acc.nbFactures + m.nbFactures,
      totalHt: acc.totalHt + m.totalHt,
      coutRenseigne: acc.coutRenseigne + m.coutRenseigne,
      margeEuros: acc.margeEuros + m.margeEuros,
      nbLignesSansPa: acc.nbLignesSansPa + m.nbLignesSansPa,
    }),
    { nbFactures: 0, totalHt: 0, coutRenseigne: 0, margeEuros: 0, nbLignesSansPa: 0 },
  );
  return {
    ...t,
    totalHt: arrondi(t.totalHt),
    coutRenseigne: arrondi(t.coutRenseigne),
    margeEuros: arrondi(t.margeEuros),
    margePct: t.totalHt === 0 ? null : arrondi((t.margeEuros / t.totalHt) * 100),
  };
}
