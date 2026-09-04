/**
 * Types du texte de contrat versionné. Le texte vit dans
 * template-v1.ts (puis v2.ts…) ; le rendu (page publique, PDF) et la
 * logique de visibilité sont communs à toutes les versions.
 */

export type QualiteClient = "particulier" | "professionnel";

export type ModeConclusion = "distance" | "hors_etablissement" | "presentiel";

/**
 * Condition d'affichage d'un bloc ou d'une annexe :
 * - « particulier » / « professionnel » : selon la qualité du client ;
 * - « retractation » : particulier ET conclu à distance ou hors
 *   établissement (art. L. 221-18 conso) ;
 * - « sans-retractation » : le complément exact de « retractation ».
 * Absente = toujours visible.
 */
export type CondAffichage =
  | "particulier"
  | "professionnel"
  | "retractation"
  | "sans-retractation";

export type BlocContrat =
  | { kind: "p"; texte: string; visible?: CondAffichage }
  | { kind: "h3"; texte: string; visible?: CondAffichage }
  | { kind: "note"; texte: string; visible?: CondAffichage }
  | { kind: "formule"; texte: string; visible?: CondAffichage }
  | { kind: "li"; items: string[]; visible?: CondAffichage }
  | { kind: "table-equipements"; visible?: CondAffichage }
  | { kind: "table-prix"; visible?: CondAffichage };

export type ArticleContrat = {
  numero: number;
  titre: string;
  blocs: BlocContrat[];
};

export type TemplateContrat = {
  version: number;
  titre: string;
  sousTitre: string;
  preambule: string;
  articles: ArticleContrat[];
  annexe: {
    visible: CondAffichage;
    titre: string;
    blocs: BlocContrat[];
  };
};

/** Une ligne du tableau des équipements couverts (art. 1.2). */
export type EquipementContrat = {
  type: string;
  marque_modele: string;
  num_serie: string;
  puissance_kw: string;
  fluide_charge: string;
};
