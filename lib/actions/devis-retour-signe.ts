"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { aujourdhuiParis } from "@/lib/dates";
import { figerEmetteurDocument } from "@/lib/actions/emetteur-helpers";
import { devisSigne } from "@/lib/devis-transitions";
import { statutAffichageDevis } from "@/lib/validations/devis";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MAX_OCTETS = 8 * 1024 * 1024;
const TYPES_ACCEPTES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

/** Type réel d'après l'extension quand le navigateur n'en donne pas (fichier iCloud, Android). */
function typeFichier(fichier: File): string {
  if (fichier.type && fichier.type !== "application/octet-stream") return fichier.type;
  const ext = fichier.name.split(".").pop()?.toLowerCase();
  const parExt: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf" };
  return (ext && parExt[ext]) || fichier.type;
}

/**
 * Le client a signé le devis sur papier et l'a renvoyé (photo, scan,
 * PDF) : on archive le document dans le bucket immuable `signatures`,
 * on note la date portée sur le papier et le nom du signataire, et le
 * devis passe en « accepté ». La colonne n'est écrite que si le devis
 * n'est pas déjà signé (ni au doigt, ni en ligne, ni sur papier).
 */
export async function joindreRetourSigneAction(devisId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, error: "Joignez la photo ou le PDF du devis signé." };
  if (fichier.size > MAX_OCTETS) return { ok: false, error: "Fichier trop lourd (8 Mo maximum)." };
  const type = typeFichier(fichier);
  const ext = TYPES_ACCEPTES[type];
  if (!ext) return { ok: false, error: `Format accepté : photo (JPEG, PNG, WebP, HEIC) ou PDF — reçu : ${fichier.type || fichier.name}.` };
  const dateSignature = String(formData.get("date_signature") ?? "").trim();
  const today = aujourdhuiParis();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateSignature)) return { ok: false, error: "Indiquez la date portée sur le devis signé." };
  if (dateSignature > today) return { ok: false, error: "La date de signature ne peut pas être dans le futur." };
  const signataireNom = String(formData.get("signataire_nom") ?? "").trim().slice(0, 120) || null;

  const { data: devis } = await supabase
    .from("devis")
    .select("id, statut, date_validite, est_modele, signature_client_url, retour_signe_url, facture_id")
    .eq("id", devisId)
    .maybeSingle();
  if (!devis) return { ok: false, error: "Devis introuvable." };
  if (devis.est_modele) return { ok: false, error: "Un modèle de devis ne se signe pas." };
  if (devisSigne(devis)) return { ok: false, error: "Ce devis est déjà signé (signature immuable)." };
  if (devis.facture_id) return { ok: false, error: "Ce devis est déjà converti en facture." };
  const statut = statutAffichageDevis(devis.statut, devis.date_validite);
  if (statut === "refuse") return { ok: false, error: "Ce devis est marqué refusé — repassez-le en envoyé avant de joindre le retour signé." };

  const path = `${user.id}/devis/${devisId}/retour-signe-${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from("signatures")
    .upload(path, fichier, { contentType: type, upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data: modifie, error } = await supabase
    .from("devis")
    .update({
      retour_signe_url: path,
      retour_signe_mime: type,
      signataire_nom: signataireNom,
      date_signature: dateSignature,
      signe_le: new Date().toISOString(),
      signature_origine: "papier",
      statut: "accepte",
    })
    .eq("id", devisId)
    .is("retour_signe_url", null)
    .is("signature_client_url", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!modifie || modifie.length === 0) return { ok: false, error: "Ce devis est déjà signé (signature immuable)." };

  await figerEmetteurDocument(supabase, "devis", devisId);
  revalidatePath(`/devis/${devisId}`);
  revalidatePath("/devis");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

/** Lien de consultation (1 h) du retour signé archivé. */
export async function lienRetourSigne(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("signatures").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
