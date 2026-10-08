/**
 * Planification d'une visite d'entretien — logique PURE, testée dans
 * visite-entretien.test.ts : validation de la saisie (date convenue
 * avec le client, heure facultative, confirmation par e-mail) et
 * libellés lisibles pour l'e-mail et les écrans.
 */

import { z } from "zod";

export const planificationVisiteSchema = z.object({
  /** Date convenue avec le client (YYYY-MM-DD). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date de visite."),
  /** Heure convenue (HH:MM), vide = dans la journée. */
  heure: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide.")
    .optional()
    .or(z.literal("")),
  /** Envoyer au client l'e-mail de confirmation de cette visite. */
  envoyerConfirmation: z.boolean(),
});

export type PlanificationVisiteInput = z.input<typeof planificationVisiteSchema>;
export type PlanificationVisite = z.output<typeof planificationVisiteSchema>;

/** « 09:30:00 » → « 9 h 30 », « 14:00 » → « 14 h ». Null si rien. */
export function heureLisible(heure: string | null | undefined): string | null {
  if (!heure) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(heure.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2]!;
  return min === "00" ? `${h} h` : `${h} h ${min}`;
}

/** Heure en base (« 09:30:00 ») → valeur d'un champ <input type="time"> (« 09:30 »). */
export function heureChamp(heure: string | null | undefined): string {
  return heure ? heure.slice(0, 5) : "";
}

/**
 * La confirmation envoyée vaut pour la date affichée : si la visite a
 * été replanifiée depuis, elle ne compte plus.
 */
export function confirmationValable(args: {
  prochaine_visite: string | null;
  confirmation_envoyee_pour: string | null;
}): boolean {
  return Boolean(args.prochaine_visite) && args.confirmation_envoyee_pour === args.prochaine_visite;
}
