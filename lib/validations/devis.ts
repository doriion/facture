import { z } from "zod";

import { ligneFactureSchema } from "@/lib/validations/facture";

const TYPES_ACTIVITE = [
  "plomberie",
  "installation_clim",
  "installation_pac",
  "entretien",
  "depannage",
  "autre",
] as const;

export const STATUTS_DEVIS = [
  "brouillon",
  "envoye",
  "accepte",
  "refuse",
  "expire",
] as const;

export type StatutDevis = (typeof STATUTS_DEVIS)[number];

/**
 * Performances énergétiques (clim/PAC) — JSONB.
 * COP : coefficient de performance instantané
 * SCOP : COP saisonnier (chauffage)
 * SEER : efficacité énergétique saisonnière (refroidissement)
 * classe_energetique : A+++, A++, A+, A, B...
 */
export const performancesSchema = z.object({
  cop: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(20).nullable(),
  ),
  scop: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(20).nullable(),
  ),
  seer: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(20).nullable(),
  ),
  classe_energetique: z
    .string()
    .trim()
    .max(10)
    .optional()
    .or(z.literal("")),
});

export type PerformancesValues = z.infer<typeof performancesSchema>;

/**
 * Equipement — réutilise la même structure que pour les factures.
 */
export const equipementDevisSchema = z.object({
  marque: z.string().trim().max(100).optional().or(z.literal("")),
  modele: z.string().trim().max(100).optional().or(z.literal("")),
  num_serie: z.string().trim().max(100).optional().or(z.literal("")),
  fluide_frigo_type: z.string().trim().max(50).optional().or(z.literal("")),
  fluide_frigo_kg: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(1000).nullable(),
  ),
});

export const aidesDevisSchema = z.object({
  maprimerenov: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).nullable(),
  ),
  cee: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).nullable(),
  ),
  eco_ptz: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).nullable(),
  ),
});

/**
 * Schéma complet d'un devis.
 * Le numéro est généré côté serveur (D-AAAA-NNNN).
 */
export const devisSchema = z.object({
  client_id: z.string().uuid("Sélectionnez un client."),
  type_activite: z.enum(TYPES_ACTIVITE),
  date_emission: z.string().min(1, "Date d'émission obligatoire."),
  date_validite: z.string().min(1, "Date de validité obligatoire."),
  date_debut_travaux: z.string().optional().or(z.literal("")),
  duree_estimee_jours: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(0).max(3650).nullable(),
  ),
  conditions: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  lignes: z
    .array(ligneFactureSchema)
    .min(1, "Au moins une ligne est requise."),
  equipement: equipementDevisSchema.default({
    marque: "",
    modele: "",
    num_serie: "",
    fluide_frigo_type: "",
    fluide_frigo_kg: null,
  }),
  performances_energetiques: performancesSchema.default({
    cop: null,
    scop: null,
    seer: null,
    classe_energetique: "",
  }),
  aides_financieres: aidesDevisSchema.default({
    maprimerenov: null,
    cee: null,
    eco_ptz: null,
  }),
});

export type DevisFormInput = z.input<typeof devisSchema>;
export type DevisFormValues = z.output<typeof devisSchema>;

/**
 * Calcule le statut d'affichage d'un devis : si la date de validité est
 * dépassée et que le devis est encore "envoye", on l'affiche "expire".
 */
export function statutAffichageDevis(
  statut: string,
  dateValidite: string,
): string {
  const today = new Date().toISOString().slice(0, 10);
  if (statut === "envoye" && dateValidite && dateValidite < today) {
    return "expire";
  }
  return statut;
}
