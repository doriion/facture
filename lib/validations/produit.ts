import { z } from "zod";

import { CATEGORIES_PRESTATIONS, UNITES, parseMoneyInput } from "@/lib/format";

const moneyInput = (v: unknown) =>
  v === "" || v === null || v === undefined ? v : parseMoneyInput(v);
const moneyInputOrNull = (v: unknown) =>
  v === "" || v === null || v === undefined ? null : parseMoneyInput(v);

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
  prix_ht: z.preprocess(
    moneyInput,
    z
      .number({ error: "Prix invalide." })
      .min(0, "Le prix ne peut pas être négatif.")
      .max(1_000_000, "Prix trop élevé."),
  ),
  // Coût réel PRIVÉ, saisi TTC (franchise en base : la TVA sur achats
  // n'est pas récupérée, le coût c'est le TTC). Jamais exposé au client.
  prix_achat_ttc: z.preprocess(
    moneyInputOrNull,
    z
      .number({ error: "Prix d'achat invalide." })
      .min(0, "Le prix d'achat ne peut pas être négatif.")
      .max(1_000_000, "Prix d'achat trop élevé.")
      .nullable(),
  ),
  fournisseur: z.string().trim().max(120).optional().or(z.literal("")),
  unite: z.enum(UNITES),
  categorie: z.enum(categorieValues),
  // Case URSSAF par défaut des lignes créées depuis ce produit.
  nature_fiscale: z
    .enum(["bic_prestations", "bic_ventes", "bnc"])
    .default("bic_prestations"),
  tva_taux_suggere: z.preprocess(
    moneyInputOrNull,
    z.number().min(0).max(100).nullable(),
  ),
  actif: z.boolean(),
});

/** Type des données après parsing (prix_ht devient number). */
export type ProduitFormValues = z.output<typeof produitSchema>;
/** Type des données en entrée du formulaire (prix_ht peut être string). */
export type ProduitFormInput = z.input<typeof produitSchema>;
