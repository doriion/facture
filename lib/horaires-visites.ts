/**
 * Horaires de l'artisan pour les visites d'entretien — logique PURE,
 * testée dans horaires-visites.test.ts. Détermine les créneaux proposés
 * aux clients : jours travaillés, tranche du matin, tranche de
 * l'après-midi (chacune peut être désactivée). Stocké en JSON dans
 * profil_entreprise.horaires_visites ; {} ou une valeur invalide =
 * valeurs par défaut.
 */

import { z } from "zod";

export type Tranche = { debut: string; fin: string };

export type HorairesVisites = {
  /** Jours travaillés, 1 = lundi … 7 = dimanche. */
  jours: number[];
  matin: Tranche | null;
  apres_midi: Tranche | null;
};

const HEURE_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const trancheSchema = z
  .object({ debut: z.string().regex(HEURE_RE, "Heure invalide."), fin: z.string().regex(HEURE_RE, "Heure invalide.") })
  .refine((t) => t.debut < t.fin, { message: "L'heure de fin doit suivre l'heure de début." });

export const horairesVisitesSchema = z
  .object({
    jours: z.array(z.number().int().min(1).max(7)).min(1, "Choisissez au moins un jour."),
    matin: trancheSchema.nullable(),
    apres_midi: trancheSchema.nullable(),
  })
  .refine((h) => h.matin || h.apres_midi, { message: "Gardez au moins une tranche (matin ou après-midi)." })
  .refine((h) => !h.matin || !h.apres_midi || h.matin.fin <= h.apres_midi.debut, {
    message: "L'après-midi doit commencer après la fin du matin.",
  });

export function horairesParDefaut(): HorairesVisites {
  return {
    jours: [1, 2, 3, 4, 5],
    matin: { debut: "08:00", fin: "12:00" },
    apres_midi: { debut: "14:00", fin: "18:00" },
  };
}

/** Valeur stockée (JSON, éventuellement vide ou abîmée) → horaires sûrs. */
export function normaliserHoraires(valeur: unknown): HorairesVisites {
  const parsed = horairesVisitesSchema.safeParse(valeur);
  if (!parsed.success) return horairesParDefaut();
  const jours = [...new Set(parsed.data.jours)].sort((a, b) => a - b);
  return { jours, matin: parsed.data.matin, apres_midi: parsed.data.apres_midi };
}

export const LABELS_JOURS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};
