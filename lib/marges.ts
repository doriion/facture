/**
 * Calculs de marge — logique PURE testée dans marges.test.ts.
 *
 * Franchise en base de TVA : la TVA sur achats n'est pas récupérée,
 * le coût réel est donc le prix d'achat TTC. La marge se calcule
 * directement prix de vente − prix d'achat TTC, sans retraitement.
 *
 * Une ligne SANS prix d'achat saisi n'a pas de marge calculable : elle
 * est exclue des totaux (les gonfler en supposant un coût nul serait
 * pire que l'ignorer) et comptée dans `nbLignesSansPa` pour l'afficher.
 * Les titres de section (type = 'titre') sont ignorés.
 */

export type LigneMargeable = {
  type?: string | null;
  quantite: number;
  prix_unitaire_ht: number;
  prix_achat_ttc_unitaire?: number | null;
};

export type MargeLigne = {
  /** Coût d'achat total de la ligne (PA TTC × qté), null si PA absent */
  coutTotal: number | null;
  /** Marge en euros (vente − coût), null si PA absent */
  margeEuros: number | null;
  /**
   * Taux de marge en % du prix de vente. Null si PA absent OU si le
   * prix de vente est 0 (division par zéro : une ligne offerte avec un
   * coût a une marge en euros négative mais pas de taux exprimable).
   */
  margePct: number | null;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

export function margeLigne(ligne: LigneMargeable): MargeLigne {
  const pa = ligne.prix_achat_ttc_unitaire;
  if (pa === null || pa === undefined) {
    return { coutTotal: null, margeEuros: null, margePct: null };
  }
  const qte = Number(ligne.quantite) || 0;
  const vente = qte * Number(ligne.prix_unitaire_ht);
  const cout = qte * Number(pa);
  const marge = vente - cout;
  return {
    coutTotal: arrondi(cout),
    margeEuros: arrondi(marge),
    margePct: vente === 0 ? null : arrondi((marge / vente) * 100),
  };
}

export type TotauxMarges = {
  /** Prix de vente cumulé des lignes AVEC prix d'achat saisi */
  venteCouverte: number;
  /** Coût d'achat total (lignes avec PA) */
  coutTotal: number;
  /** Marge totale en euros (lignes avec PA) */
  margeTotale: number;
  /** Taux de marge global en % de la vente couverte, null si vente 0 */
  tauxMargePct: number | null;
  /** Lignes normales sans prix d'achat saisi (marge inconnue) */
  nbLignesSansPa: number;
};

export function totauxMarges(lignes: LigneMargeable[]): TotauxMarges {
  let venteCouverte = 0;
  let coutTotal = 0;
  let nbLignesSansPa = 0;

  for (const ligne of lignes) {
    if (ligne.type === "titre") continue;
    const pa = ligne.prix_achat_ttc_unitaire;
    if (pa === null || pa === undefined) {
      nbLignesSansPa += 1;
      continue;
    }
    const qte = Number(ligne.quantite) || 0;
    venteCouverte += qte * Number(ligne.prix_unitaire_ht);
    coutTotal += qte * Number(pa);
  }

  const margeTotale = venteCouverte - coutTotal;
  return {
    venteCouverte: arrondi(venteCouverte),
    coutTotal: arrondi(coutTotal),
    margeTotale: arrondi(margeTotale),
    tauxMargePct:
      venteCouverte === 0 ? null : arrondi((margeTotale / venteCouverte) * 100),
    nbLignesSansPa,
  };
}
