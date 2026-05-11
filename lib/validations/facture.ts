import { z } from "zod";

const TYPES_ACTIVITE = [
  "plomberie",
  "installation_clim",
  "installation_pac",
  "entretien",
  "depannage",
  "autre",
] as const;

export type TypeActivite = (typeof TYPES_ACTIVITE)[number];

export const STATUTS_FACTURE = [
  "brouillon",
  "envoyee",
  "payee",
  "retard",
  "annulee",
] as const;

export type StatutFacture = (typeof STATUTS_FACTURE)[number];

/**
 * Une ligne de facture saisie dans le formulaire.
 * `id` (UUID) optionnel : présent à l'édition (ligne existante en base),
 * absent à la création.
 */
export const ligneFactureSchema = z.object({
  id: z.string().uuid().optional(),
  designation: z
    .string()
    .trim()
    .min(1, "La désignation est obligatoire.")
    .max(500),
  quantite: z.coerce
    .number({ error: "Quantité invalide." })
    .positive("La quantité doit être positive.")
    .max(100000, "Quantité trop élevée."),
  prix_unitaire_ht: z.coerce
    .number({ error: "Prix unitaire invalide." })
    .min(0, "Le prix ne peut pas être négatif.")
    .max(1_000_000, "Prix trop élevé."),
});

/**
 * Equipement intervenu (stocké en JSONB sur la facture).
 * Tous les champs optionnels — affiché uniquement pour clim/PAC.
 */
export const equipementSchema = z.object({
  marque: z.string().trim().max(100).optional().or(z.literal("")),
  modele: z.string().trim().max(100).optional().or(z.literal("")),
  num_serie: z.string().trim().max(100).optional().or(z.literal("")),
  fluide_frigo_type: z.string().trim().max(50).optional().or(z.literal("")),
  fluide_frigo_kg: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.coerce.number().min(0).max(1000).nullable(),
  ),
});

export type EquipementValues = z.infer<typeof equipementSchema>;

/**
 * Aides financières (information client, stocké en JSONB).
 */
export const aidesFinancieresSchema = z.object({
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

export type AidesFinancieresValues = z.infer<typeof aidesFinancieresSchema>;

/**
 * Schéma complet d'une facture (en-tête + lignes).
 * Le champ `numero` est généré côté serveur — pas dans le formulaire.
 * Le `total_ht` est recalculé serveur-side depuis les lignes.
 */
export const factureSchema = z.object({
  client_id: z.string().uuid("Sélectionnez un client."),
  type_activite: z.enum(TYPES_ACTIVITE),
  date_emission: z.string().min(1, "Date d'émission obligatoire."),
  date_echeance: z.string().min(1, "Date d'échéance obligatoire."),
  date_prestation: z.string().optional().or(z.literal("")),
  date_prestation_fin: z.string().optional().or(z.literal("")),
  conditions_paiement: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  lignes: z
    .array(ligneFactureSchema)
    .min(1, "Au moins une ligne est requise."),
  equipement: equipementSchema.default({
    marque: "",
    modele: "",
    num_serie: "",
    fluide_frigo_type: "",
    fluide_frigo_kg: null,
  }),
  aides_financieres: aidesFinancieresSchema.default({
    maprimerenov: null,
    cee: null,
    eco_ptz: null,
  }),
})
  .superRefine((val, ctx) => {
    // Cohérence des dates de prestation (si les deux remplies)
    if (
      val.date_prestation &&
      val.date_prestation_fin &&
      val.date_prestation_fin < val.date_prestation
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["date_prestation_fin"],
        message: "La date de fin doit être postérieure au début.",
      });
    }
  });

export type FactureFormInput = z.input<typeof factureSchema>;
export type FactureFormValues = z.output<typeof factureSchema>;

/**
 * Calcule le total HT d'une liste de lignes (somme qté × PU HT).
 * Arrondi au centime.
 */
export function computeTotalHt(
  lignes: Array<{ quantite: number; prix_unitaire_ht: number }>,
): number {
  const total = lignes.reduce(
    (sum, l) => sum + Number(l.quantite) * Number(l.prix_unitaire_ht),
    0,
  );
  return Math.round(total * 100) / 100;
}

/**
 * Vérifie si un type d'activité concerne la clim/PAC (= section équipement
 * et performances pertinente).
 */
export function isClimPac(type: TypeActivite | string): boolean {
  return type === "installation_clim" || type === "installation_pac";
}
