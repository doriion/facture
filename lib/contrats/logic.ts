import { TEMPLATE_CONTRAT_V1 } from "@/lib/contrats/template-v1";
import type {
  BlocContrat,
  CondAffichage,
  ModeConclusion,
  QualiteClient,
  TemplateContrat,
} from "@/lib/contrats/types";

/**
 * Logique PURE du module contrats — aucune I/O, testée dans
 * logic.test.ts : registre des versions de texte, visibilité des
 * sections, interpolation des valeurs, validité du lien public,
 * montants et échéance.
 */

const TEMPLATES: Record<number, TemplateContrat> = {
  1: TEMPLATE_CONTRAT_V1,
};

/** Version utilisée pour tout NOUVEAU contrat. */
export const TEMPLATE_VERSION_COURANTE = 1;

/**
 * Le texte d'une version donnée. Lève si la version est inconnue :
 * mieux vaut une erreur franche qu'un contrat régénéré avec le
 * mauvais texte.
 */
export function getTemplateContrat(version: number): TemplateContrat {
  const template = TEMPLATES[version];
  if (!template) {
    throw new Error(`Version de contrat inconnue : ${version}`);
  }
  return template;
}

export type ContexteAffichage = {
  qualiteClient: QualiteClient;
  modeConclusion: ModeConclusion;
};

/**
 * Le droit de rétractation (art. L. 221-18 conso) ne s'applique qu'au
 * consommateur pour un contrat conclu à distance ou hors établissement.
 */
export function retractationApplicable(ctx: ContexteAffichage): boolean {
  return (
    ctx.qualiteClient === "particulier" && ctx.modeConclusion !== "presentiel"
  );
}

export function blocVisible(
  visible: CondAffichage | undefined,
  ctx: ContexteAffichage,
): boolean {
  switch (visible) {
    case undefined:
      return true;
    case "particulier":
      return ctx.qualiteClient === "particulier";
    case "professionnel":
      return ctx.qualiteClient === "professionnel";
    case "retractation":
      return retractationApplicable(ctx);
    case "sans-retractation":
      return !retractationApplicable(ctx);
  }
}

/** Les blocs d'un article filtrés selon le contexte. */
export function blocsVisibles(
  blocs: BlocContrat[],
  ctx: ContexteAffichage,
): BlocContrat[] {
  return blocs.filter((b) => blocVisible(b.visible, ctx));
}

/**
 * Remplace les espaces réservés {commeCeci}. Une clé absente ou vide
 * devient des pointillés « …… » (comme les blancs du contrat papier),
 * jamais le texte brut de l'espace réservé.
 */
export function remplirTexte(
  texte: string,
  valeurs: Record<string, string | null | undefined>,
): string {
  return texte.replace(/\{([a-zA-Z]+)\}/g, (_, cle: string) => {
    const v = valeurs[cle];
    return v && v.trim() ? v : "……";
  });
}

/** Net à payer par visite annuelle = redevance − remise, plancher 0. */
export function netAPayer(redevance: number, remise: number): number {
  const net = Number(redevance) - Number(remise);
  return Math.round(Math.max(0, net) * 100) / 100;
}

/** Échéance initiale (art. 7) : un an après la date d'effet. */
export function echeanceInitiale(dateEffetIso: string): string {
  const d = new Date(`${dateEffetIso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export type EtatLienPublic =
  | "utilisable"
  | "deja-signe"
  | "expire"
  | "revoque"
  | "introuvable";

/**
 * État d'un lien public de signature. Le token n'est utilisable que
 * pour un contrat au statut « envoye », non expiré (30 jours), non
 * révoqué. Après signature, la page peut encore reconnaître le contrat
 * (« deja-signe ») pour afficher la confirmation — mais plus rien
 * n'est modifiable.
 */
export function etatLienPublic(
  contrat: {
    statut: string;
    access_token: string | null;
    token_expires_at: string | null;
  } | null,
  nowIso: string,
): EtatLienPublic {
  if (!contrat) return "introuvable";
  if (
    contrat.statut === "signe" ||
    contrat.statut === "actif" ||
    contrat.statut === "resilie" ||
    contrat.statut === "expire"
  ) {
    return "deja-signe";
  }
  if (contrat.statut !== "envoye" || !contrat.access_token) return "revoque";
  if (!contrat.token_expires_at) return "revoque";
  if (contrat.token_expires_at <= nowIso) return "expire";
  return "utilisable";
}

/** Durée de vie d'un lien de signature : 30 jours. */
export const DUREE_TOKEN_JOURS = 30;

export function expirationToken(nowIso: string): string {
  const d = new Date(nowIso);
  d.setUTCDate(d.getUTCDate() + DUREE_TOKEN_JOURS);
  return d.toISOString();
}

export const LABELS_QUALITE: Record<QualiteClient, string> = {
  particulier: "Particulier (consommateur)",
  professionnel: "Professionnel",
};

export const LABELS_MODE_CONCLUSION: Record<ModeConclusion, string> = {
  distance: "À distance",
  hors_etablissement: "Hors établissement (au domicile du client)",
  presentiel: "En présentiel (en établissement)",
};

export const LABELS_STATUT_CONTRAT_SIGNE: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé — en attente de signature",
  signe: "Signé",
  actif: "Actif",
  resilie: "Résilié",
  expire: "Expiré",
};
