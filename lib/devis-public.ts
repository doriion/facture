/**
 * Lien public de signature d'un devis — logique PURE, testée dans
 * devis-public.test.ts : état du lien et fin de validité.
 */

import { z } from "zod";

import { instantDepuisLocale } from "@/lib/dates";

export type EtatLienDevis = "utilisable" | "signe" | "expire" | "revoque" | "introuvable";

export type DevisLiable = {
  statut: string;
  est_modele: boolean;
  access_token: string | null;
  token_expires_at: string | null;
  signature_client_url: string | null;
  facture_id: string | null;
  date_validite: string | null;
};

/**
 * Le lien vaut tant que le devis est envoyé, non signé, non converti,
 * non refusé, encore valable, et que le jeton n'a pas expiré. Un devis
 * signé garde un lien « signé » (page de confirmation, PDF 30 jours).
 */
export function etatLienDevis(d: DevisLiable | null, nowIso: string, today: string): EtatLienDevis {
  if (!d || !d.access_token) return "introuvable";
  if (d.est_modele) return "revoque";
  if (d.signature_client_url || d.statut === "accepte") return "signe";
  if (d.facture_id || d.statut === "refuse" || d.statut === "brouillon") return "revoque";
  if (d.token_expires_at && d.token_expires_at <= nowIso) return "expire";
  if (d.date_validite && d.date_validite < today) return "expire";
  return "utilisable";
}

/** Fin de validité du lien : fin de la journée de validité du devis (heure de Paris), sinon 30 jours. */
export function expirationLienDevis(dateValidite: string | null, nowIso: string): string {
  if (dateValidite && /^\d{4}-\d{2}-\d{2}$/.test(dateValidite)) {
    const [a, m, j] = dateValidite.split("-").map(Number);
    return instantDepuisLocale("Europe/Paris", a!, m!, j!, 23, 59).toISOString();
  }
  const d = new Date(nowIso);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString();
}

/** Saisie du client sur la page publique. */
export const signatureDevisPubliqueSchema = z.object({
  signataire_nom: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  accepte: z.literal(true, { error: "Cochez la case « bon pour accord » pour signer." }),
});
