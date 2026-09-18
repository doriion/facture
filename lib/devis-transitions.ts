/**
 * Machine à états des devis — PURE, testée dans devis-transitions.test.ts.
 *
 * Même patron que TRANSITIONS_MANUELLES des contrats d'entretien : la
 * table décrit les passages MANUELS autorisés (boutons « Marquer
 * envoyé », « Accepté », « Refusé », « Repasser en brouillon »). Les
 * passages AUTOMATIQUES ont leurs propres actions et leurs propres
 * gardes : la signature client fait passer en « accepté », la
 * conversion en facture verrouille le devis.
 *
 * « expire » n'est jamais stocké : c'est un affichage calculé pour un
 * devis « envoye » dont la date de validité est dépassée
 * (statutAffichageDevis). Il figure ici pour que l'interface, qui
 * raisonne sur le statut affiché, puisse proposer le retour en
 * brouillon sans se tromper.
 */

/** Statuts réellement stockés en base. */
export const STATUTS_DEVIS_STOCKES = [
  "brouillon",
  "envoye",
  "accepte",
  "refuse",
] as const;

export type StatutDevisStocke = (typeof STATUTS_DEVIS_STOCKES)[number];

/**
 * Passages manuels autorisés, depuis le statut AFFICHÉ.
 * « accepte » ne peut que revenir en brouillon, et seulement s'il n'est
 * ni signé ni converti (motifVerrouDevis) : une acceptation cochée par
 * erreur se corrige, un devis signé ou facturé reste figé.
 */
export const TRANSITIONS_DEVIS: Record<string, readonly StatutDevisStocke[]> = {
  brouillon: ["envoye"],
  envoye: ["accepte", "refuse", "brouillon"],
  expire: ["brouillon"],
  refuse: ["brouillon"],
  accepte: ["brouillon"],
};

export type ContexteDevis = {
  /** signature_client_url renseignée → signature immuable */
  signee?: boolean;
  /** facture_id renseigné → devis converti, figé */
  convertie?: boolean;
  /** est_modele → hors du cycle de vie des devis */
  modele?: boolean;
};

export type ResultatTransition =
  | { ok: true }
  | { ok: false; error: string };

export const MOTIF_DEVIS_SIGNE =
  "Ce devis est signé par le client : son contenu et son statut ne sont plus modifiables.";
export const MOTIF_DEVIS_CONVERTI =
  "Ce devis a été converti en facture et ne peut plus être modifié.";
export const MOTIF_DEVIS_MODELE =
  "Un modèle de devis n'a pas de cycle de vie : il sert à créer des devis.";

function estStatutStocke(v: string): v is StatutDevisStocke {
  return (STATUTS_DEVIS_STOCKES as readonly string[]).includes(v);
}

/**
 * Un devis signé ou converti est figé : ni contenu, ni statut, ni
 * suppression. Sert aussi bien aux actions qu'à la page d'édition.
 */
export function motifVerrouDevis(ctx: ContexteDevis = {}): string | null {
  if (ctx.convertie) return MOTIF_DEVIS_CONVERTI;
  if (ctx.signee) return MOTIF_DEVIS_SIGNE;
  return null;
}

/** Le devis peut-il encore être modifié (contenu, lignes, suppression) ? */
export function devisModifiable(ctx: ContexteDevis = {}): boolean {
  return motifVerrouDevis(ctx) === null;
}

/**
 * Transition manuelle autorisée ? Renvoie un motif exploitable
 * directement comme message d'erreur d'une server action.
 */
export function transitionDevisAutorisee(
  statutActuel: string,
  cible: string,
  ctx: ContexteDevis = {},
): ResultatTransition {
  if (ctx.modele) return { ok: false, error: MOTIF_DEVIS_MODELE };

  const verrou = motifVerrouDevis(ctx);
  if (verrou) return { ok: false, error: verrou };

  if (!estStatutStocke(cible)) {
    return { ok: false, error: `Statut « ${cible} » inconnu.` };
  }
  if (statutActuel === cible) {
    return { ok: false, error: `Le devis est déjà « ${cible} ».` };
  }

  const autorises = TRANSITIONS_DEVIS[statutActuel] ?? [];
  if (!autorises.includes(cible)) {
    return {
      ok: false,
      error: `Passage « ${statutActuel} » → « ${cible} » non autorisé.`,
    };
  }
  return { ok: true };
}

/**
 * Signature client : réservée aux devis envoyés (ou affichés expirés,
 * le client peut signer un devis dont la validité vient d'échoir).
 * Un brouillon n'a jamais été transmis au client, un devis refusé doit
 * d'abord repasser en envoyé, un modèle ne se signe pas.
 */
export function signatureDevisAutorisee(
  statutActuel: string,
  ctx: ContexteDevis = {},
): ResultatTransition {
  if (ctx.modele) {
    return { ok: false, error: "Un modèle de devis ne se signe pas." };
  }
  if (ctx.signee) {
    return { ok: false, error: "Ce devis est déjà signé (signature immuable)." };
  }
  if (ctx.convertie) return { ok: false, error: MOTIF_DEVIS_CONVERTI };

  if (statutActuel === "brouillon") {
    return {
      ok: false,
      error:
        "Ce devis est encore en brouillon — marquez-le envoyé avant de le faire signer.",
    };
  }
  if (statutActuel === "refuse") {
    return {
      ok: false,
      error:
        "Ce devis est marqué refusé — repassez-le en envoyé avant signature.",
    };
  }
  if (statutActuel === "accepte") {
    return { ok: false, error: "Ce devis est déjà accepté." };
  }
  return { ok: true };
}

/**
 * Conversion en facture : réservée aux devis acceptés (la signature
 * client passe le devis en accepté, donc le flux signé reste fluide).
 */
export function conversionDevisAutorisee(
  statutActuel: string,
  ctx: ContexteDevis = {},
): ResultatTransition {
  if (ctx.modele) {
    return { ok: false, error: "Un modèle de devis ne se convertit pas." };
  }
  if (ctx.convertie) {
    return { ok: false, error: "Ce devis a déjà été converti en facture." };
  }
  if (statutActuel !== "accepte") {
    return {
      ok: false,
      error:
        "Seul un devis accepté se convertit en facture — marquez-le accepté (ou faites-le signer) d'abord.",
    };
  }
  return { ok: true };
}
