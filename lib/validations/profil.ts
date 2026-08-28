import { z } from "zod";

import { REGEX } from "@/lib/format";

/**
 * Schéma Zod pour le profil entreprise (auto-entrepreneur BTP).
 *
 * Stratégie : tous les champs sont optionnels au niveau type, mais ceux qui
 * sont critiques (SIRET, RM, décennale, fluides frigo) sont validés s'ils
 * sont remplis. Le profil peut donc être sauvegardé partiellement, mais
 * un profil valide pour l'émission de factures requerra ces champs.
 */
export const profilSchema = z.object({
  // Identité
  nom: z.string().trim().max(100).optional().or(z.literal("")),
  prenom: z.string().trim().max(100).optional().or(z.literal("")),
  nom_commercial: z.string().trim().max(150).optional().or(z.literal("")),

  // Identifiants légaux
  siret: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || REGEX.siret.test(v), {
      message: "Le SIRET doit contenir exactement 14 chiffres.",
    }),
  code_ape: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || REGEX.codeApe.test(v), {
      message: "Code APE invalide (ex: 4322A).",
    }),
  num_rm: z.string().trim().max(50).optional().or(z.literal("")),

  // Adresse
  adresse_ligne1: z.string().trim().max(200).optional().or(z.literal("")),
  adresse_ligne2: z.string().trim().max(200).optional().or(z.literal("")),
  code_postal: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || REGEX.codePostal.test(v), {
      message: "Code postal invalide (5 chiffres).",
    }),
  ville: z.string().trim().max(100).optional().or(z.literal("")),
  pays: z.string().trim().max(50).optional().or(z.literal("")),

  // Contact
  email_pro: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: "Adresse email invalide.",
    }),
  telephone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || REGEX.telephoneFr.test(v), {
      message: "Numéro de téléphone invalide (format FR).",
    }),
  site_web: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || z.string().url().safeParse(v).success,
      { message: "URL invalide (incluez https://)." },
    ),

  // BTP - Décennale
  num_assurance_decennale: z.string().trim().max(100).optional().or(z.literal("")),
  assureur_decennale: z.string().trim().max(150).optional().or(z.literal("")),
  assureur_decennale_adresse: z
    .string()
    .trim()
    .max(300)
    .optional()
    .or(z.literal("")),
  zone_couverture_decennale: z.string().trim().max(200).optional().or(z.literal("")),

  // Clim/PAC
  num_attestation_fluides_frigo: z.string().trim().max(100).optional().or(z.literal("")),
  num_rge_qualipac: z.string().trim().max(100).optional().or(z.literal("")),

  // Banque
  iban: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || REGEX.ibanFr.test(v), {
      message: "IBAN français invalide (FR + 25 caractères).",
    }),
  bic: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || REGEX.bic.test(v.replace(/\s+/g, "")), {
      message: "BIC invalide (8 ou 11 caractères).",
    }),
  banque_nom: z.string().trim().max(100).optional().or(z.literal("")),

  // Médiateur conso
  mediateur_nom: z.string().trim().max(150).optional().or(z.literal("")),
  mediateur_site_web: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || z.string().url().safeParse(v).success,
      { message: "URL invalide (incluez https://)." },
    ),
  mediateur_adresse: z.string().trim().max(300).optional().or(z.literal("")),

  // Préférences
  conditions_paiement_default: z.string().trim().max(500).optional().or(z.literal("")),
  penalites_retard_text: z.string().trim().max(1000).optional().or(z.literal("")),
  escompte_text: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ProfilFormValues = z.infer<typeof profilSchema>;
