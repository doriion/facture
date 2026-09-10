import { z } from "zod";

/**
 * Champs complétés par le CLIENT sur la page publique de signature.
 * Volontairement tolérant sur les formats (saisie au téléphone) mais
 * strict sur la présence de l'essentiel et sur les consentements.
 */
export const contratSignatureSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Indiquez votre nom ou votre raison sociale.")
    .max(200),
  adresse: z
    .string()
    .trim()
    .min(5, "Indiquez votre adresse complète.")
    .max(500),
  telephone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Adresse e-mail invalide.")
    .max(200),
  siret: z.string().trim().max(20).optional().or(z.literal("")),
  occupant: z.enum(["proprietaire", "locataire"], {
    error: "Indiquez si vous êtes propriétaire ou locataire.",
  }),
  contact_site: z.string().trim().max(200).optional().or(z.literal("")),
  signataire_qualite: z.string().trim().max(120).optional().or(z.literal("")),
  accepte_contrat: z.literal(true, {
    error: "Vous devez accepter les termes du contrat pour signer.",
  }),
  // Contrôlée par la route selon que la rétractation s'applique
  accepte_retractation: z.boolean().default(false),
});

export type ContratSignatureInput = z.input<typeof contratSignatureSchema>;
export type ContratSignatureValues = z.output<typeof contratSignatureSchema>;
