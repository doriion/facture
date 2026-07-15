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
  date_fin: z.string().optional().or(z.literal("")),
  heure_debut: z.string().optional().or(z.literal("")),
  heure_fin: z.string().optional().or(z.literal("")),
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
  // Charge totale de l'équipement (cadre 3 du CERFA 15497 — sert au
  // calcul t éq. CO2 et à la périodicité du contrôle d'étanchéité)
  fluide_charge_totale_kg: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(10000).nullable(),
  ),
  // Contrôle d'étanchéité (cadres 5 et 10 du CERFA 15497)
  etancheite_controle: z.boolean().nullable().optional(),
  etancheite_detecteur: z.string().trim().max(200).optional().or(z.literal("")),
  etancheite_detecteur_controle_le: z.string().optional().or(z.literal("")),
  etancheite_fuite: z.boolean().nullable().optional(),
  etancheite_fuite_localisation: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("")),
  fluide_observations: z.string().trim().max(2000).optional().or(z.literal("")),

  duree_minutes: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(0).max(10000).nullable(),
  ),

  facture_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
}).superRefine((val, ctx) => {
  if (val.date_fin && val.date_intervention && val.date_fin < val.date_intervention) {
    ctx.addIssue({
      code: "custom",
      path: ["date_fin"],
      message: "La date de fin doit être postérieure ou égale au début.",
    });
  }
  if (
    val.heure_debut &&
    val.heure_fin &&
    val.heure_fin < val.heure_debut &&
    // Si plage sur un seul jour : la fin doit être après le début
    (!val.date_fin || val.date_fin === val.date_intervention)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["heure_fin"],
      message: "L'heure de fin doit être postérieure au début.",
    });
  }
}).transform((val) => {
  // Cohérence étanchéité : l'UI masque les champs conditionnels quand le
  // contrôle repasse à « non », mais react-hook-form garde leurs valeurs.
  // On les neutralise ici pour ne jamais persister un enregistrement
  // contradictoire (controle=false + fuite=true), quel que soit l'UI.
  if (val.etancheite_controle !== true) {
    return {
      ...val,
      etancheite_detecteur: "",
      etancheite_detecteur_controle_le: "",
      etancheite_fuite: null,
      etancheite_fuite_localisation: "",
    };
  }
  if (val.etancheite_fuite !== true) {
    return { ...val, etancheite_fuite_localisation: "" };
  }
  return val;
});

export type InterventionFormInput = z.input<typeof interventionSchema>;
export type InterventionFormValues = z.output<typeof interventionSchema>;
