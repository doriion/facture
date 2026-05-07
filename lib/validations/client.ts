import { z } from "zod";

import { REGEX } from "@/lib/format";

/**
 * Schéma client. Le nom est obligatoire ; le SIRET n'est requis que pour
 * les clients pro et est validé en cross-field via superRefine.
 */
export const clientSchema = z
  .object({
    nom: z.string().trim().min(1, "Le nom est obligatoire.").max(150),
    type: z.enum(["particulier", "professionnel", "syndic"]),
    siret: z.string().trim().optional().or(z.literal("")),
    raison_sociale: z.string().trim().max(150).optional().or(z.literal("")),
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
    email: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || z.string().email().safeParse(v).success, {
        message: "Email invalide.",
      }),
    telephone: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || REGEX.telephoneFr.test(v), {
        message: "Numéro de téléphone invalide (format FR).",
      }),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    // SIRET requis et valide pour les clients pro
    if (val.type === "professionnel") {
      if (!val.siret) {
        ctx.addIssue({
          code: "custom",
          path: ["siret"],
          message: "SIRET obligatoire pour un client professionnel.",
        });
      } else if (!REGEX.siret.test(val.siret)) {
        ctx.addIssue({
          code: "custom",
          path: ["siret"],
          message: "Le SIRET doit contenir exactement 14 chiffres.",
        });
      }
    } else if (val.siret && !REGEX.siret.test(val.siret)) {
      ctx.addIssue({
        code: "custom",
        path: ["siret"],
        message: "Le SIRET doit contenir exactement 14 chiffres.",
      });
    }
  });

export type ClientFormValues = z.infer<typeof clientSchema>;
