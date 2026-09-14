"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { figerEmetteurDocument } from "@/lib/actions/emetteur-helpers";
import { signatureDevisAutorisee } from "@/lib/devis-transitions";
import { statutAffichageDevis } from "@/lib/validations/devis";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MAX_SIGNATURE_BYTES = 500 * 1024;

/**
 * Enregistre la signature « Bon pour accord » du client sur un devis
 * (canvas tactile, PNG) et passe le devis en « accepté ».
 *
 * Immuabilité (même règle que les signatures d'intervention) : le PNG
 * va dans le bucket 'signatures' (policies insert/select uniquement,
 * pas de delete) et la colonne n'est écrite QUE si elle est encore
 * NULL — un devis signé ne peut être ni re-signé ni dé-signé depuis
 * l'application.
 */
export async function signerDevisAction(
  devisId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const file = formData.get("signature");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Signature manquante." };
  }
  if (file.size > MAX_SIGNATURE_BYTES) {
    return { ok: false, error: "Signature trop volumineuse." };
  }

  const { data: devis } = await supabase
    .from("devis")
    .select(
      "id, statut, date_validite, est_modele, signature_client_url, facture_id",
    )
    .eq("id", devisId)
    .maybeSingle();
  if (!devis) return { ok: false, error: "Devis introuvable." };

  // Gardes centralisées (lib/devis-transitions) : modèle, déjà signé,
  // converti, brouillon jamais transmis, devis refusé, déjà accepté.
  const autorisee = signatureDevisAutorisee(
    statutAffichageDevis(devis.statut, devis.date_validite),
    {
      signee: !!devis.signature_client_url,
      convertie: !!devis.facture_id,
      modele: devis.est_modele,
    },
  );
  if (!autorisee.ok) return { ok: false, error: autorisee.error };

  const path = `${user.id}/devis/${devisId}/bon-pour-accord-${Date.now()}.png`;
  const { error: uploadErr } = await supabase.storage
    .from("signatures")
    .upload(path, file, { contentType: "image/png", upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  // `.is(..., null)` : jamais d'écrasement, même en cas de course.
  const today = new Date().toISOString().slice(0, 10);
  const { data: updated, error: updateErr } = await supabase
    .from("devis")
    .update({
      signature_client_url: path,
      date_signature: today,
      statut: "accepte",
    })
    .eq("id", devisId)
    .is("signature_client_url", null)
    .select("id");
  if (updateErr) return { ok: false, error: updateErr.message };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Ce devis est déjà signé (signature immuable)." };
  }

  // Devis signé = engageant : mentions émetteur figées.
  await figerEmetteurDocument(supabase, "devis", devisId);

  revalidatePath(`/devis/${devisId}`);
  revalidatePath("/devis");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}
