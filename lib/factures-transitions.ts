/**
 * Machine à états des factures — logique PURE, testée dans
 * factures-transitions.test.ts. Pendant de lib/devis-transitions.ts.
 *
 * Règles :
 * - « payee » ne se décrète pas : elle découle des paiements enregistrés
 *   (lib/paiements-helpers). Passer une facture « payée » à la main sans
 *   paiement fausserait le CA encaissé (jauges, export URSSAF).
 * - Une facture payée ne redevient « envoyée » que par le flux dédié qui
 *   traite ses paiements (repasserEnvoyeeAction), jamais directement.
 * - Une facture qui porte des paiements ne redevient pas brouillon (son
 *   contenu ne doit plus bouger), elle s'annule.
 * - Une facture « ventilée » (facture normale dont des acomptes ou un
 *   solde ont été émis) ne s'envoie pas et ne s'encaisse pas : ce sont
 *   ses enfants qui sont facturés et encaissés. Sinon le montant serait
 *   compté deux fois (parent + acompte + solde).
 */

export const STATUTS_FACTURE_STOCKES = ["brouillon", "envoyee", "payee", "annulee"] as const;
export type StatutFactureStocke = (typeof STATUTS_FACTURE_STOCKES)[number];

/** Passages manuels autorisés (setFactureStatutAction). */
export const TRANSITIONS_FACTURE: Record<StatutFactureStocke, readonly StatutFactureStocke[]> = {
  brouillon: ["envoyee", "annulee"],
  envoyee: ["brouillon", "annulee"],
  payee: ["annulee"],
  annulee: ["brouillon"],
};

export type ContexteFacture = {
  /** Nombre de paiements enregistrés sur la facture. */
  nbPaiements?: number;
  /** Facture normale dont des acomptes / un solde non annulés existent. */
  ventilee?: boolean;
};

export type ResultatTransition = { ok: true } | { ok: false; error: string };

export const MOTIF_FACTURE_VENTILEE =
  "Cette facture est ventilée en acompte(s) et solde : ce sont eux qui s'envoient et s'encaissent, pas la facture d'origine.";

export function estStatutFactureStocke(v: string): v is StatutFactureStocke {
  return (STATUTS_FACTURE_STOCKES as readonly string[]).includes(v);
}

export function transitionFactureAutorisee(
  statutActuel: string,
  cible: string,
  ctx: ContexteFacture = {},
): ResultatTransition {
  if (!estStatutFactureStocke(cible)) {
    return { ok: false, error: `Statut « ${cible} » inconnu.` };
  }
  if (!estStatutFactureStocke(statutActuel)) {
    return { ok: false, error: `Statut actuel « ${statutActuel} » inconnu.` };
  }
  if (statutActuel === cible) {
    return { ok: false, error: `La facture est déjà « ${cible} ».` };
  }
  if (cible === "payee") {
    return {
      ok: false,
      error: "Une facture passe « payée » en enregistrant un paiement (Marquer payée), pas à la main.",
    };
  }
  if (cible === "envoyee" && ctx.ventilee) {
    return { ok: false, error: MOTIF_FACTURE_VENTILEE };
  }
  if (cible === "brouillon" && (ctx.nbPaiements ?? 0) > 0) {
    return {
      ok: false,
      error:
        "Des paiements sont enregistrés sur cette facture : elle ne peut pas repasser en brouillon. Supprimez d'abord les paiements, ou annulez-la.",
    };
  }
  const autorises = TRANSITIONS_FACTURE[statutActuel];
  if (!autorises.includes(cible)) {
    return { ok: false, error: `Passage « ${statutActuel} » → « ${cible} » non autorisé.` };
  }
  return { ok: true };
}

/** Un paiement peut-il être enregistré sur cette facture ? */
export function paiementAutorise(
  statut: string,
  ctx: { ventilee?: boolean; resteDu: number; montant: number },
): ResultatTransition {
  if (statut === "annulee") {
    return { ok: false, error: "Impossible d'enregistrer un paiement sur une facture annulée." };
  }
  if (ctx.ventilee) return { ok: false, error: MOTIF_FACTURE_VENTILEE };
  if (!(ctx.montant > 0)) return { ok: false, error: "Le montant doit être positif." };
  // Tolérance d'un centime d'arrondi ; au-delà, c'est un trop-perçu à
  // traiter à part (avoir), pas un encaissement de cette facture.
  if (ctx.montant > ctx.resteDu + 0.011) {
    return {
      ok: false,
      error: `Le montant dépasse le reste dû (${ctx.resteDu.toFixed(2).replace(".", ",")} €).`,
    };
  }
  return { ok: true };
}

/**
 * Facture « ventilée » : facture normale dont au moins un acompte ou
 * solde non annulé existe.
 */
export function estFactureVentilee(
  facture: { type_facture?: string | null },
  enfants: Array<{ statut: string }>,
): boolean {
  const type = facture.type_facture ?? "normale";
  return type === "normale" && enfants.some((e) => e.statut !== "annulee");
}

/**
 * Statut AFFICHÉ d'une facture : « retard » quand elle est envoyée et
 * échue, « ventilee » pour une facture d'origine remplacée par ses
 * acomptes/solde, sinon le statut stocké. Même règle pour la liste, la
 * fiche et l'historique client.
 */
export function statutAffichageFacture(
  facture: { statut: string; date_echeance?: string | null; type_facture?: string | null },
  aujourdhui: string,
  opts: { ventilee?: boolean } = {},
): string {
  if (opts.ventilee && facture.statut !== "annulee") return "ventilee";
  if (facture.statut === "envoyee" && facture.date_echeance && facture.date_echeance < aujourdhui) {
    return "retard";
  }
  return facture.statut;
}
