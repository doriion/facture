/**
 * Fiches gaz (fluides frigorigènes) — logique PURE, testée dans
 * fiches-gaz.test.ts : validation de la saisie, totaux des manipulations
 * de fluide, options CERFA déduites de la fiche, numéro de fiche, état
 * du lien de signature.
 */

import { z } from "zod";

import { NATURES_INTERVENTION, type CerfaOptions, type NatureIntervention } from "@/lib/cerfa";

export const TYPES_EQUIPEMENT = {
  climatisation: "Climatisation",
  pompe_a_chaleur: "Pompe à chaleur",
} as const;
export type TypeEquipement = keyof typeof TYPES_EQUIPEMENT;

export const NATURES_INJECTION = {
  vierge: "Fluide vierge",
  recycle: "Fluide recyclé",
  regenere: "Fluide régénéré",
} as const;
export const NATURES_RECUPERATION = {
  traitement: "Destiné au traitement",
  reutilisation: "Conservé pour réutilisation",
} as const;
export type NatureManipulation = keyof typeof NATURES_INJECTION | keyof typeof NATURES_RECUPERATION;

export type Manipulation = {
  type: "injection" | "recuperation";
  nature: NatureManipulation;
  kg: number;
};

const manipulationSchema = z
  .object({
    type: z.enum(["injection", "recuperation"]),
    nature: z.enum(["vierge", "recycle", "regenere", "traitement", "reutilisation"]),
    kg: z.preprocess(
      (v) => (typeof v === "string" ? Number(v.trim().replace(",", ".")) : v),
      z.number().min(0).max(10000),
    ),
  })
  .refine(
    (m) => (m.type === "injection" ? m.nature in NATURES_INJECTION : m.nature in NATURES_RECUPERATION),
    { message: "Nature incompatible avec le type de manipulation." },
  );

/** Valeur stockée (JSON) → manipulations sûres (les lignes abîmées sont ignorées). */
export function manipulationsDepuisJson(valeur: unknown): Manipulation[] {
  if (!Array.isArray(valeur)) return [];
  return valeur.flatMap((m) => {
    const p = manipulationSchema.safeParse(m);
    return p.success ? [p.data as Manipulation] : [];
  });
}

export type TotauxManipulations = {
  ajoute: number;
  recupere: number;
  vierge: number;
  recycle: number;
  regenere: number;
  traitement: number;
  reutilisation: number;
};

function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function totauxManipulations(ms: Manipulation[]): TotauxManipulations {
  const t: TotauxManipulations = { ajoute: 0, recupere: 0, vierge: 0, recycle: 0, regenere: 0, traitement: 0, reutilisation: 0 };
  for (const m of ms) {
    t[m.nature] = r3(t[m.nature] + m.kg);
    if (m.type === "injection") t.ajoute = r3(t.ajoute + m.kg);
    else t.recupere = r3(t.recupere + m.kg);
  }
  return t;
}

/** « 261030 » pour le 30/10/2026, « 261030-2 » pour la deuxième fiche du jour. */
export function numeroFiche(dateYmd: string, rangDuJour: number): string {
  const [a, m, j] = dateYmd.split("-");
  const base = `${(a ?? "").slice(2)}${m ?? ""}${j ?? ""}`;
  return rangDuJour > 1 ? `${base}-${rangDuJour}` : base;
}

/** Type d'intervention (agenda, statistiques) déduit des natures cochées. */
export function typeInterventionDepuisNatures(natures: string[]): "installation" | "entretien" | "depannage" | "autre" {
  if (natures.includes("assemblage") || natures.includes("mise_en_service")) return "installation";
  if (natures.includes("maintenance") || natures.includes("controle_periodique")) return "entretien";
  if (natures.includes("modification") || natures.includes("controle_non_periodique")) return "depannage";
  return "autre";
}

/** Libellés courts des natures d'intervention (puces du formulaire). */
export const NATURES_COURTES: Record<NatureIntervention, string> = {
  assemblage: "Assemblage",
  mise_en_service: "Mise en service",
  modification: "Modification",
  maintenance: "Maintenance / entretien",
  controle_periodique: "Contrôle d'étanchéité périodique",
  controle_non_periodique: "Contrôle non périodique",
  demantelement: "Démantèlement",
};

/** Objets de travaux proposés pour le bon de réception. */
export const OBJETS_BON = ["Fourniture et pose d'une pompe à chaleur", "Fourniture et pose d'une climatisation"] as const;

/** « Climatisation Daikin — repère UE1 » pour les e-mails et les listes. */
export function libelleEquipement(f: {
  equipement_type: string | null;
  equipement_marque: string | null;
  equipement_repere: string | null;
}): string | null {
  const type = f.equipement_type && f.equipement_type in TYPES_EQUIPEMENT ? TYPES_EQUIPEMENT[f.equipement_type as TypeEquipement] : null;
  const tete = [type, f.equipement_marque?.trim() || null].filter(Boolean).join(" ");
  const repere = f.equipement_repere?.trim();
  const texte = [tete || null, repere ? `repère ${repere}` : null].filter(Boolean).join(" — ");
  return texte || null;
}

/** « Sans réserve » / « Avec réserves : … » / « Réserves non renseignées ». */
export function libelleReserves(reserves: string | null, texte: string | null): string {
  if (reserves === "sans") return "Sans réserve";
  if (reserves === "avec") return texte?.trim() ? `Avec réserves : ${texte.trim()}` : "Avec réserves";
  return "Réserves non renseignées";
}

/**
 * Descriptif de l'intervention (agenda, bon) déduit de la fiche quand
 * l'artisan n'en saisit pas : objet du bon, sinon natures cochées.
 */
export function descriptionDepuisFiche(f: { bon_objet: string | null | undefined; natures_cerfa: string[]; equipement_type: string | null | undefined }): string {
  const objet = f.bon_objet?.trim();
  if (objet) return objet;
  const natures = f.natures_cerfa.filter((n): n is NatureIntervention => n in NATURES_COURTES).map((n) => NATURES_COURTES[n]);
  const type = f.equipement_type && f.equipement_type in TYPES_EQUIPEMENT ? TYPES_EQUIPEMENT[f.equipement_type as TypeEquipement].toLowerCase() : null;
  if (natures.length > 0) return `${natures.join(", ")}${type ? ` — ${type}` : ""}`;
  return `Fiche fluides frigorigènes${type ? ` — ${type}` : ""}`;
}

/**
 * Intervention telle que le CERFA doit la lire : description de
 * l'équipement (type + repère) à la place du descriptif des travaux,
 * contrôle d'étanchéité réputé fait dès qu'un détecteur ou un contrôle
 * est renseigné (la réparation de la fuite a sa colonne au cadre 10).
 */
export function interventionPourCerfa<T extends {
  description: string | null;
  equipement_type: string | null;
  equipement_repere: string | null;
  etancheite_controle: boolean | null;
  etancheite_detecteur: string | null;
  etancheite_fuite: boolean | null;
  etancheite_fuite_localisation: string | null;
  fuite_reparation: string | null;
  natures_cerfa: string[];
}>(it: T): T {
  const type = it.equipement_type && it.equipement_type in TYPES_EQUIPEMENT ? TYPES_EQUIPEMENT[it.equipement_type as TypeEquipement] : null;
  const description = [type, it.equipement_repere?.trim() ? `repère ${it.equipement_repere.trim()}` : null].filter(Boolean).join(" — ") || it.description;
  const controle =
    it.etancheite_controle === true ||
    Boolean(it.etancheite_detecteur?.trim()) ||
    it.natures_cerfa.includes("controle_periodique") ||
    it.natures_cerfa.includes("controle_non_periodique");
  const localisation = it.etancheite_fuite ? it.etancheite_fuite_localisation?.trim() || null : it.etancheite_fuite_localisation;
  return {
    ...it,
    description,
    etancheite_controle: controle ? true : it.etancheite_controle,
    etancheite_fuite: controle ? it.etancheite_fuite ?? false : it.etancheite_fuite,
    etancheite_fuite_localisation: localisation || null,
  };
}

/** Options du CERFA (cadres 4, 6, 11) déduites de la fiche, sans ressaisie. */
export function cerfaOptionsDepuisFiche(f: {
  fiche_numero: string | null;
  natures_cerfa: string[];
  nature_autre?: string | null;
  detection_permanente: boolean;
  fluide_manipulations: unknown;
  dechets_bsff?: string | null;
  dechets_contenants?: string | null;
  dechets_destination?: string | null;
}): CerfaOptions {
  const t = totauxManipulations(manipulationsDepuisJson(f.fluide_manipulations));
  const dechets = [f.dechets_bsff, f.dechets_contenants, f.dechets_destination].some((v) => (v ?? "").trim());
  return {
    ficheNumero: f.fiche_numero ?? "",
    natures: f.natures_cerfa.filter((n): n is NatureIntervention => n in NATURES_INTERVENTION),
    natureAutre: f.nature_autre?.trim() ?? "",
    systemePermanentDetection: f.detection_permanente,
    chargeViergeKg: t.vierge,
    chargeRecycleKg: t.recycle,
    chargeRegenereKg: t.regenere,
    recupereTraitementKg: t.traitement,
    recupereReutilisationKg: t.reutilisation,
    dechets: dechets
      ? {
          numeroBsff: f.dechets_bsff?.trim() ?? "",
          contenants: f.dechets_contenants?.trim() ?? "",
          destinationNom: f.dechets_destination?.trim() ?? "",
        }
      : null,
  };
}

const texte = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const nombre = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v.replace(",", ".")) : v),
  z.number().min(0).max(10000).nullable(),
);

export const ficheGazSchema = z.object({
  client_id: z.string().uuid("Sélectionnez un client."),
  date_intervention: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date obligatoire."),
  natures_cerfa: z.array(z.enum(Object.keys(NATURES_INTERVENTION) as [NatureIntervention, ...NatureIntervention[]])).default([]),
  nature_autre: texte(120),
  equipement_type: z.enum(["climatisation", "pompe_a_chaleur"]).nullable().optional(),
  equipement_marque: texte(100),
  equipement_repere: texte(100),
  equipement_modele: texte(100),
  equipement_num_serie: texte(100),
  fluide_frigo_type: texte(50),
  fluide_charge_totale_kg: nombre,
  fluide_manipulations: z.array(manipulationSchema).max(20).default([]),
  etancheite_detecteur: texte(200),
  etancheite_detecteur_controle_le: texte(10),
  detection_permanente: z.boolean().default(false),
  etancheite_fuite: z.boolean().nullable().optional(),
  etancheite_fuite_localisation: texte(500),
  fuite_reparation: z.enum(["realisee", "a_faire"]).nullable().optional(),
  fluide_observations: texte(2000),
  dechets_bsff: texte(60),
  dechets_contenants: texte(200),
  dechets_destination: texte(300),
  bon_devis_numero: texte(60),
  bon_objet: texte(200),
  bon_reserves: z.enum(["sans", "avec"]).nullable().optional(),
  bon_reserves_texte: texte(1000),
});
export type FicheGazInput = z.input<typeof ficheGazSchema>;
export type FicheGazValues = z.output<typeof ficheGazSchema>;

export type EtatLienFiche = "utilisable" | "signe" | "expire" | "introuvable";

/** Lien de signature du détenteur : utilisable tant qu'il n'a pas signé et que le jeton n'a pas expiré. */
export function etatLienFiche(
  it: { signature_token: string | null; signature_token_expires_at: string | null; supprime_le: string | null } | null,
  detenteurSigne: boolean,
  nowIso: string,
): EtatLienFiche {
  if (!it || !it.signature_token || it.supprime_le) return "introuvable";
  if (detenteurSigne) return "signe";
  if (it.signature_token_expires_at && it.signature_token_expires_at <= nowIso) return "expire";
  return "utilisable";
}

/** Saisie du détenteur sur la page publique. */
export const signatureFichePubliqueSchema = z.object({
  signataire_nom: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  signataire_qualite: z.string().trim().max(120).optional().or(z.literal("")),
  bon_reserves: z.enum(["sans", "avec"]),
  bon_reserves_texte: z.string().trim().max(1000).optional().or(z.literal("")),
});

/** Valeurs proposées à l'ouverture d'une nouvelle fiche (tout est modifiable). */
export type FichePrefill = Partial<{
  client_id: string;
  date_intervention: string;
  natures_cerfa: NatureIntervention[];
  equipement_type: TypeEquipement;
  equipement_marque: string;
  equipement_repere: string;
  equipement_modele: string;
  equipement_num_serie: string;
  fluide_frigo_type: string;
  fluide_charge_totale_kg: string;
  etancheite_detecteur: string;
  etancheite_detecteur_controle_le: string;
  detection_permanente: boolean;
  bon_devis_numero: string;
  bon_objet: string;
}>;

const txt = (v: string | null | undefined) => (v ?? "").trim();
const kgTexte = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));

/**
 * Nouvelle visite sur un équipement déjà vu (fiche ou intervention
 * précédente) : client et matériel repris, la date, les natures, les
 * quantités et les réserves restent à saisir.
 */
export function prefillDepuisIntervention(it: {
  client_id: string | null;
  equipement_type?: string | null;
  equipement_marque: string | null;
  equipement_repere?: string | null;
  equipement_modele: string | null;
  equipement_num_serie: string | null;
  fluide_frigo_type: string | null;
  fluide_charge_totale_kg: number | string | null;
  etancheite_detecteur?: string | null;
  etancheite_detecteur_controle_le?: string | null;
  detection_permanente?: boolean | null;
}): FichePrefill {
  const p: FichePrefill = {
    equipement_marque: txt(it.equipement_marque),
    equipement_repere: txt(it.equipement_repere),
    equipement_modele: txt(it.equipement_modele),
    equipement_num_serie: txt(it.equipement_num_serie),
    fluide_frigo_type: txt(it.fluide_frigo_type),
    fluide_charge_totale_kg: kgTexte(it.fluide_charge_totale_kg),
    detection_permanente: it.detection_permanente ?? false,
  };
  if (it.client_id) p.client_id = it.client_id;
  if (it.equipement_type === "climatisation" || it.equipement_type === "pompe_a_chaleur") p.equipement_type = it.equipement_type;
  if (txt(it.etancheite_detecteur)) {
    p.etancheite_detecteur = txt(it.etancheite_detecteur);
    p.etancheite_detecteur_controle_le = txt(it.etancheite_detecteur_controle_le);
  }
  return p;
}

/**
 * Fiche de mise en service d'après un devis accepté : client, n° de
 * devis, objet et natures déduits de l'activité, matériel du devis.
 */
export function prefillDepuisDevis(devis: {
  client_id: string;
  numero: string;
  type_activite: string;
  equipement_info: unknown;
}): FichePrefill {
  const eq = (devis.equipement_info && typeof devis.equipement_info === "object" ? devis.equipement_info : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof eq[k] === "string" ? (eq[k] as string).trim() : "");
  const p: FichePrefill = {
    client_id: devis.client_id,
    bon_devis_numero: devis.numero,
    equipement_marque: str("marque"),
    equipement_modele: str("modele"),
    equipement_num_serie: str("num_serie"),
    fluide_frigo_type: str("fluide_frigo_type").toUpperCase(),
    fluide_charge_totale_kg: kgTexte(typeof eq.fluide_frigo_kg === "number" || typeof eq.fluide_frigo_kg === "string" ? eq.fluide_frigo_kg : null),
  };
  switch (devis.type_activite) {
    case "installation_clim":
      p.equipement_type = "climatisation";
      p.bon_objet = OBJETS_BON[1];
      p.natures_cerfa = ["assemblage", "mise_en_service"];
      break;
    case "installation_pac":
      p.equipement_type = "pompe_a_chaleur";
      p.bon_objet = OBJETS_BON[0];
      p.natures_cerfa = ["assemblage", "mise_en_service"];
      break;
    case "entretien":
      p.natures_cerfa = ["maintenance"];
      break;
    case "depannage":
      p.natures_cerfa = ["modification"];
      break;
  }
  return p;
}
