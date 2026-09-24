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
 * - Un AVOIR (type_facture = 'avoir', numéroté A-AAAA-NNNN) corrige une
 *   facture émise sans la modifier. Émis, il ne revient pas en
 *   brouillon : il s'annule. Mode « imputation » : il vient en déduction
 *   du reste dû de la facture d'origine (pas d'encaissement possible sur
 *   l'avoir). Mode « remboursement » : la facture d'origine est payée,
 *   le remboursement s'enregistre comme un paiement de l'avoir et vient
 *   en MOINS des recettes encaissées.
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
  /** Type du document (normale, acompte, solde, avoir). */
  typeFacture?: string | null;
};

export const TYPE_AVOIR = "avoir";
export const MODES_AVOIR = ["imputation", "remboursement"] as const;
export type ModeAvoir = (typeof MODES_AVOIR)[number];

export const LABELS_MODE_AVOIR: Record<ModeAvoir, string> = {
  imputation: "Imputé sur la facture (vient en déduction du reste dû)",
  remboursement: "À rembourser au client (facture déjà encaissée)",
};

export function estModeAvoir(v: unknown): v is ModeAvoir {
  return typeof v === "string" && (MODES_AVOIR as readonly string[]).includes(v);
}

export function estAvoir(facture: { type_facture?: string | null }): boolean {
  return facture.type_facture === TYPE_AVOIR;
}

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
  if (ctx.typeFacture === TYPE_AVOIR && statutActuel === "envoyee" && cible === "brouillon") {
    return {
      ok: false,
      error:
        "Un avoir émis ne revient pas en brouillon : il a déjà modifié le reste dû de la facture d'origine. Annulez-le (motif conservé) et créez-en un autre.",
    };
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
  ctx: {
    ventilee?: boolean;
    resteDu: number;
    montant: number;
    typeFacture?: string | null;
    modeAvoir?: string | null;
  },
): ResultatTransition {
  if (statut === "annulee") {
    return { ok: false, error: "Impossible d'enregistrer un paiement sur une facture annulée." };
  }
  if (ctx.ventilee) return { ok: false, error: MOTIF_FACTURE_VENTILEE };
  if (ctx.typeFacture === TYPE_AVOIR && ctx.modeAvoir !== "remboursement") {
    return {
      ok: false,
      error:
        "Cet avoir est imputé sur la facture d'origine : il n'y a rien à encaisser ni à rembourser.",
    };
  }
  if (ctx.typeFacture === TYPE_AVOIR && statut === "brouillon") {
    return { ok: false, error: "Émettez l'avoir avant d'enregistrer le remboursement." };
  }
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
  enfants: Array<{ statut: string; type_facture?: string | null }>,
): boolean {
  const type = facture.type_facture ?? "normale";
  return (
    type === "normale" &&
    enfants.some((e) => e.statut !== "annulee" && e.type_facture !== TYPE_AVOIR)
  );
}

/** Statuts affichés propres aux avoirs (jamais stockés). */
export const STATUTS_AFFICHAGE_AVOIR = {
  avoir_emis: "Avoir émis (imputé)",
  avoir_a_rembourser: "Avoir à rembourser",
  avoir_rembourse: "Avoir remboursé",
} as const;

/**
 * Plafond d'un avoir selon son mode :
 * - imputation : au plus le reste dû de la facture d'origine (total −
 *   encaissé − avoirs déjà imputés) ;
 * - remboursement : au plus ce qui a été encaissé et pas encore rendu
 *   (encaissé − avoirs de remboursement déjà émis).
 * Arrondi au centime, jamais négatif.
 */
export function montantAvoirMax(
  mode: ModeAvoir,
  ctx: {
    totalFacture: number;
    totalEncaisse: number;
    avoirsImputes: number;
    avoirsRembourses: number;
  },
): number {
  const brut =
    mode === "imputation"
      ? ctx.totalFacture - ctx.totalEncaisse - ctx.avoirsImputes
      : ctx.totalEncaisse - ctx.avoirsRembourses;
  return Math.max(0, Math.round(brut * 100) / 100);
}

/** Un avoir de ce montant et de ce mode peut-il être émis sur la facture ? */
export function montantAvoirAutorise(
  mode: ModeAvoir,
  montant: number,
  ctx: {
    statutFacture: string;
    typeFacture?: string | null;
    ventilee?: boolean;
    totalFacture: number;
    totalEncaisse: number;
    avoirsImputes: number;
    avoirsRembourses: number;
  },
): ResultatTransition {
  if (ctx.typeFacture === TYPE_AVOIR) {
    return { ok: false, error: "Un avoir ne se corrige pas par un avoir : annulez-le et créez-en un autre." };
  }
  if (ctx.statutFacture === "brouillon") {
    return { ok: false, error: "Un brouillon se corrige directement : l'avoir ne sert qu'aux factures émises." };
  }
  if (ctx.statutFacture === "annulee") {
    return { ok: false, error: "Cette facture est annulée : rien à créditer." };
  }
  if (ctx.ventilee) return { ok: false, error: MOTIF_FACTURE_VENTILEE };
  if (!Number.isFinite(montant) || montant <= 0) {
    return { ok: false, error: "Le montant de l'avoir doit être positif." };
  }
  const max = montantAvoirMax(mode, ctx);
  if (max <= 0) {
    return {
      ok: false,
      error:
        mode === "imputation"
          ? "Rien à imputer : la facture est déjà soldée. Pour rendre de l'argent, choisissez « remboursement »."
          : "Rien à rembourser : aucun encaissement sur cette facture. Choisissez « imputation ».",
    };
  }
  if (montant > max + 0.011) {
    return {
      ok: false,
      error: `Le montant dépasse le plafond de cet avoir (${max.toFixed(2).replace(".", ",")} €).`,
    };
  }
  return { ok: true };
}

/**
 * Statut AFFICHÉ d'une facture : « retard » quand elle est envoyée et
 * échue, « ventilee » pour une facture d'origine remplacée par ses
 * acomptes/solde, sinon le statut stocké. Même règle pour la liste, la
 * fiche et l'historique client.
 */
export function statutAffichageFacture(
  facture: {
    statut: string;
    date_echeance?: string | null;
    type_facture?: string | null;
    mode_avoir?: string | null;
  },
  aujourdhui: string,
  opts: { ventilee?: boolean } = {},
): string {
  if (facture.type_facture === TYPE_AVOIR) {
    // Un avoir n'est jamais « en retard » ni « payé » : émis (imputé), à
    // rembourser, remboursé.
    if (facture.statut === "envoyee") {
      return facture.mode_avoir === "remboursement" ? "avoir_a_rembourser" : "avoir_emis";
    }
    if (facture.statut === "payee") return "avoir_rembourse";
    return facture.statut;
  }
  if (opts.ventilee && facture.statut !== "annulee") return "ventilee";
  if (facture.statut === "envoyee" && facture.date_echeance && facture.date_echeance < aujourdhui) {
    return "retard";
  }
  return facture.statut;
}
