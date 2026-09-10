import { z } from "zod";

import { parseMoneyInput } from "@/lib/format";

/** Préprocesseur pour montants saisis comme texte (FR/EN tolérant). */
const moneyInput = (v: unknown) =>
  v === "" || v === null || v === undefined ? 0 : parseMoneyInput(v);

export const QUALITES_CLIENT = ["particulier", "professionnel"] as const;
export const MODES_CONCLUSION = [
  "distance",
  "hors_etablissement",
  "presentiel",
] as const;

/** Une ligne du tableau des équipements couverts (art. 1.2). */
export const equipementContratSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1, "Le type d'équipement est obligatoire.")
    .max(120),
  marque_modele: z.string().trim().max(120).optional().or(z.literal("")),
  num_serie: z.string().trim().max(120).optional().or(z.literal("")),
  puissance_kw: z.string().trim().max(20).optional().or(z.literal("")),
  fluide_charge: z.string().trim().max(60).optional().or(z.literal("")),
});

/**
 * Formulaire admin d'un contrat d'entretien. Les champs complétés par
 * le client (occupant, contact site, coordonnées) ne sont PAS ici —
 * ils arrivent par la page publique de signature.
 */
export const contratEntretienSchema = z.object({
  client_id: z.string().uuid("Sélectionnez un client."),
  adresse_site: z.string().trim().max(500).optional().or(z.literal("")),
  equipements: z
    .array(equipementContratSchema)
    .min(1, "Ajoutez au moins un équipement couvert."),
  redevance: z.preprocess(
    moneyInput,
    z
      .number({ error: "Redevance invalide." })
      .min(0, "La redevance ne peut pas être négative.")
      .max(100_000, "Redevance trop élevée."),
  ),
  remise: z.preprocess(
    moneyInput,
    z.number({ error: "Remise invalide." }).min(0).max(100_000),
  ),
  plafond_pieces: z.preprocess(
    moneyInput,
    z.number({ error: "Plafond invalide." }).min(0).max(10_000),
  ),
  date_effet: z.string().min(1, "La date d'effet est obligatoire."),
  qualite_client: z.enum(QUALITES_CLIENT),
  mode_conclusion: z.enum(MODES_CONCLUSION),
});

export type ContratEntretienFormInput = z.input<typeof contratEntretienSchema>;
export type ContratEntretienFormValues = z.output<
  typeof contratEntretienSchema
>;
