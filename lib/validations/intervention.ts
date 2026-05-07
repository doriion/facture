import { z } from "zod";

export const TYPES_INTERVENTION = [
  "installation",
  "depannage",
  "entretien",
  "autre",
] as const;

export type TypeIntervention = (typeof TYPES_INTERVENTION)[number];

export const LABELS_TYPE_INTERVENTION = {
  installation: "Installation",
  depannage: "Dépannage",
  entretien: "Entretien",
  autre: "Autre",
} as const;

/**
 * Schéma intervention — suivi chantier + traçabilité fluides frigorigènes
 * (réglementation F-Gas pour les installations clim/PAC).
 *
 * Le bilan kg ajoutés / kg récupérés est obligatoire pour les contrôles
 * et les bilans annuels.
 */
export const interventionSchema = z.object({
  client_id: z.string().uuid("Sélectionnez un client."),
  date_intervention: z.string().min(1, "Date obligatoire."),
  type: z.enum(TYPES_INTERVENTION),
  description: z.string().trim().max(2000).optional().or(z.literal("")),

  // Équipement
  equipement_marque: z.string().trim().max(100).optional().or(z.literal("")),
  equipement_modele: z.string().trim().max(100).optional().or(z.literal("")),
  equipement_num_serie: z.string().trim().max(100).optional().or(z.literal("")),

  // Fluides frigorigènes (F-Gas)
  fluide_frigo_type: z.string().trim().max(50).optional().or(z.literal("")),
  fluide_frigo_kg_ajoute: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(1000).nullable(),
  ),
  fluide_frigo_kg_recupere: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(1000).nullable(),
  ),

  duree_minutes: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(0).max(10000).nullable(),
  ),

  facture_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type InterventionFormInput = z.input<typeof interventionSchema>;
export type InterventionFormValues = z.output<typeof interventionSchema>;
