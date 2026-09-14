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

export type MargeReelle = {
  /** Total HT du document, toutes lignes (main-d'œuvre incluse) */
  totalHt: number;
  /** Coût d'achat total RENSEIGNÉ — le même que TotauxMarges.coutTotal */
  coutRenseigne: number;
  /** Total HT − coût renseigné */
  margeEuros: number;
  /** En % du total HT, null si le total est 0 */
  margePct: number | null;
};

/**
 * Marge RÉELLE : ce qui reste du total encaissé une fois payés les
 * achats effectivement saisis. Elle répond à une autre question que
 * `totauxMarges` :
 *
 *   - marge matériel  = vente − achat, sur les seules lignes qui ont
 *                       un prix d'achat (« est-ce que je marge sur ce
 *                       que je revends ? ») ;
 *   - marge réelle    = total HT − achats renseignés (« combien il me
 *                       reste sur ce devis, main-d'œuvre comprise ? »).
 *
 * Elle ne suppose AUCUN coût sur les lignes sans prix d'achat : ces
 * lignes comptent dans le total (c'est de l'encaissé) mais rien n'est
 * déduit pour elles. Si un achat n'a pas été saisi, la marge réelle est
 * donc surestimée — c'est au bloc d'affichage de le rappeler, pas à ce
 * calcul d'inventer un chiffre.
 *
 * Avant cotisations : en micro-entreprise, environ 21 % du total
 * encaissé se déduisent ensuite. Ce calcul ne les retranche pas, il
 * mesure la marge brute d'exploitation du document.
 *
 * `coutRenseigne` est pris tel quel plutôt que recalculé, pour que les
 * deux marges affichées côte à côte partagent strictement le même
 * coût d'achat — une seule source, aucune divergence possible.
 */
export function margeReelle(
  totalHt: number,
  coutRenseigne: number,
): MargeReelle {
  const total = Number(totalHt) || 0;
  const cout = Number(coutRenseigne) || 0;
  const marge = total - cout;
  return {
    totalHt: arrondi(total),
    coutRenseigne: arrondi(cout),
    margeEuros: arrondi(marge),
    margePct: total === 0 ? null : arrondi((marge / total) * 100),
  };
}
