import { z } from "zod";

import { ajouterMois } from "@/lib/mois";

export const FREQUENCES = ["annuelle", "semestrielle", "trimestrielle"] as const;
export type Frequence = (typeof FREQUENCES)[number];

export const STATUTS_CONTRAT = ["actif", "suspendu", "termine"] as const;
export type StatutContrat = (typeof STATUTS_CONTRAT)[number];

export const LABELS_FREQUENCE = {
  annuelle: "Annuelle",
  semestrielle: "Semestrielle (2/an)",
  trimestrielle: "Trimestrielle (4/an)",
} as const;

export const LABELS_STATUT_CONTRAT = {
  actif: "Actif",
  suspendu: "Suspendu",
  termine: "Terminé",
} as const;

export const contratSchema = z.object({
  client_id: z.string().uuid("Sélectionnez un client."),
  intitule: z.string().trim().max(200).optional().or(z.literal("")),
  equipement: z.string().trim().max(200).optional().or(z.literal("")),
  equipement_num_serie: z.string().trim().max(100).optional().or(z.literal("")),
  date_debut: z.string().min(1, "Date de début obligatoire."),
  date_fin: z.string().optional().or(z.literal("")),
  frequence: z.enum(FREQUENCES),
  prix_annuel_ht: z.coerce
    .number({ error: "Prix annuel invalide." })
    .min(0, "Prix négatif impossible.")
    .max(1_000_000),
  prochaine_visite: z.string().optional().or(z.literal("")),
  statut: z.enum(STATUTS_CONTRAT).default("actif"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ContratFormInput = z.input<typeof contratSchema>;
export type ContratFormValues = z.output<typeof contratSchema>;

/**
 * Calcule la date de la prochaine visite à partir d'une date de référence
 * et d'une fréquence. Renvoie une chaîne ISO (YYYY-MM-DD).
 */
export function nextVisitDate(
  fromDate: string | Date,
  frequence: Frequence,
): string {
  const iso =
    typeof fromDate === "string"
      ? fromDate.slice(0, 10)
      : fromDate.toISOString().slice(0, 10);
  const monthsToAdd =
    frequence === "annuelle"
      ? 12
      : frequence === "semestrielle"
        ? 6
        : 3;
  // ajouterMois borne au dernier jour du mois cible : une visite
  // planifiée un 31 août + 6 mois tombe au 28 février, pas au 3 mars
  // (le setMonth() natif débordait).
  return ajouterMois(iso, monthsToAdd);
}

/**
 * Prix à facturer par visite selon la fréquence (= prix_annuel_ht / nb visites/an).
 */
export function pricePerVisit(
  prixAnnuelHt: number,
  frequence: Frequence,
): number {
  const visitsPerYear =
    frequence === "annuelle" ? 1 : frequence === "semestrielle" ? 2 : 4;
  return Math.round((prixAnnuelHt / visitsPerYear) * 100) / 100;
}
