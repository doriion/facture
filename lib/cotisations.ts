/**
 * Estimation des cotisations micro-entrepreneur à provisionner,
 * calculée sur l'ENCAISSÉ (même base que la déclaration URSSAF).
 *
 * Le barème n'est PAS en dur : table `taux_cotisations` (une ligne =
 * un jeu de taux applicable à partir de `date_debut`), l'UI Paramètres
 * permet de l'ajuster. Ce fichier fournit les défauts proposés à la
 * création et la mécanique pure (choix du taux par date, calcul,
 * détection de bascule).
 *
 * Défauts pour un artisan BTP (BIC prestations, versement libératoire),
 * ACRE en cours — à confirmer avec ses propres notifications URSSAF :
 *   - ACRE (50 % du taux plein) : 10,60 % + 0,30 % CFP + 1,70 % VL
 *   - Taux plein à compter du 01/04/2027 : 21,20 % + 0,30 % + 1,70 %
 */

export type TauxCotisations = {
  date_debut: string; // YYYY-MM-DD
  libelle: string;
  taux_social: number; // %
  taux_cfp: number; // %
  taux_vl: number; // %
};

/** Date de bascule ACRE → taux plein pour ce compte (début T5 civil). */
export const DATE_BASCULE_ACRE_DEFAUT = "2027-04-01";

export const BAREME_DEFAUT: TauxCotisations[] = [
  {
    date_debut: "2026-04-01",
    libelle: "ACRE (1re période) — BIC prestations, versement libératoire",
    taux_social: 10.6,
    taux_cfp: 0.3,
    taux_vl: 1.7,
  },
  {
    date_debut: DATE_BASCULE_ACRE_DEFAUT,
    libelle: "Taux plein — BIC prestations, versement libératoire",
    taux_social: 21.2,
    taux_cfp: 0.3,
    taux_vl: 1.7,
  },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function tauxTotalPct(t: TauxCotisations): number {
  return round2(t.taux_social + t.taux_cfp + t.taux_vl);
}

/**
 * Jeu de taux applicable à une date : la ligne du barème dont
 * date_debut est la plus récente parmi celles ≤ date. Null si la date
 * précède toute ligne du barème.
 */
export function tauxApplicable(
  bareme: TauxCotisations[],
  date: string,
): TauxCotisations | null {
  let best: TauxCotisations | null = null;
  for (const t of bareme) {
    if (t.date_debut <= date && (best === null || t.date_debut > best.date_debut)) {
      best = t;
    }
  }
  return best;
}

export type ProvisionCotisations = {
  taux: TauxCotisations;
  tauxTotalPct: number;
  montantSocial: number;
  montantCfp: number;
  montantVl: number;
  montantTotal: number;
};

/**
 * Provision sur un montant encaissé, au barème applicable à `date`
 * (par défaut : les taux du jour). Les cotisations se déclarent avec
 * le CA du trimestre → on applique le taux en vigueur sur la période.
 */
export function provisionCotisations(
  encaisse: number,
  bareme: TauxCotisations[],
  date: string,
): ProvisionCotisations | null {
  const taux = tauxApplicable(bareme, date);
  if (!taux || !Number.isFinite(encaisse) || encaisse < 0) return null;
  const montantSocial = round2((encaisse * taux.taux_social) / 100);
  const montantCfp = round2((encaisse * taux.taux_cfp) / 100);
  const montantVl = round2((encaisse * taux.taux_vl) / 100);
  return {
    taux,
    tauxTotalPct: tauxTotalPct(taux),
    montantSocial,
    montantCfp,
    montantVl,
    montantTotal: round2(montantSocial + montantCfp + montantVl),
  };
}

/**
 * Prochaine hausse de taux dans les `horizonMois` mois à venir (défaut
 * 6) : sert à afficher l'avertissement « à CA égal, la provision passe
 * de X % à Y % » avant la fin de l'ACRE. Null si aucune hausse proche.
 */
export function prochaineBascule(
  bareme: TauxCotisations[],
  date: string,
  horizonMois = 6,
): { date: string; avant: TauxCotisations; apres: TauxCotisations } | null {
  const courant = tauxApplicable(bareme, date);
  if (!courant) return null;

  const limite = new Date(date + "T00:00:00Z");
  limite.setUTCMonth(limite.getUTCMonth() + horizonMois);
  const limiteIso = limite.toISOString().slice(0, 10);

  const futurs = bareme
    .filter((t) => t.date_debut > date && t.date_debut <= limiteIso)
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut));

  for (const f of futurs) {
    if (tauxTotalPct(f) > tauxTotalPct(courant)) {
      return { date: f.date_debut, avant: courant, apres: f };
    }
  }
  return null;
}

/** Bornes [start, end) du trimestre civil contenant `date`. */
export function trimestreCourant(date: string): {
  label: string;
  start: string;
  end: string;
} {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const q = Math.floor((month - 1) / 3) + 1;
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = q === 4 ? 1 : startMonth + 3;
  const endYear = q === 4 ? year + 1 : year;
  return {
    label: `T${q} ${year}`,
    start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    end: `${endYear}-${String(endMonth).padStart(2, "0")}-01`,
  };
}
