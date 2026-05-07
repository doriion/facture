import { z } from "zod";

import { CATEGORIES_PRESTATIONS, UNITES } from "@/lib/format";

const categorieValues = Object.keys(CATEGORIES_PRESTATIONS) as [
  keyof typeof CATEGORIES_PRESTATIONS,
  ...Array<keyof typeof CATEGORIES_PRESTATIONS>,
];

/**
 * Schéma produit/service. Le prix est saisi en string par le formulaire
 * (input type=number renvoie une chaîne) puis coercé en number.
 */
export const produitSchema = z.object({
  designation: z
    .string()
    .trim()
    .min(1, "La désignation est obligatoire.")
    .max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  prix_ht: z.coerce
    .number({ error: "Prix HT invalide." })
    .min(0, "Le prix ne peut pas être négatif.")
    .max(1_000_000, "Prix HT trop élevé."),
  unite: z.enum(UNITES),
  categorie: z.enum(categorieValues),
  tva_taux_suggere: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(100).nullable(),
  ),
  actif: z.boolean(),
});

/** Type des données après parsing (prix_ht devient number). */
export type ProduitFormValues = z.output<typeof produitSchema>;
/** Type des données en entrée du formulaire (prix_ht peut être string). */
export type ProduitFormInput = z.input<typeof produitSchema>;
