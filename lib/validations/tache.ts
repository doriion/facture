import { z } from "zod";

export const PRIORITES_TACHE = ["normale", "urgente"] as const;

export type PrioriteTache = (typeof PRIORITES_TACHE)[number];

/**
 * Schéma d'une tâche du pense-bête. Tout est optionnel sauf le titre :
 * la saisie éclair sur téléphone doit passer avec juste un titre.
 * Les liens (client / intervention / devis / facture) sont exclusifs
 * dans l'UI mais le schéma les tolère tous — la base les accepte.
 */
export const tacheSchema = z.object({
  titre: z
    .string()
    .trim()
    .min(1, "Écrivez ce qu'il ne faut pas oublier.")
    .max(300, "Titre trop long (300 caractères max)."),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  date_echeance: z.string().optional().or(z.literal("")),
  heure: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (HH:MM).")
    .optional()
    .or(z.literal("")),
  priorite: z.enum(PRIORITES_TACHE).default("normale"),
  client_id: z.string().uuid().optional().or(z.literal("")),
  intervention_id: z.string().uuid().optional().or(z.literal("")),
  devis_id: z.string().uuid().optional().or(z.literal("")),
  facture_id: z.string().uuid().optional().or(z.literal("")),
});

export type TacheFormInput = z.input<typeof tacheSchema>;
export type TacheFormValues = z.output<typeof tacheSchema>;
