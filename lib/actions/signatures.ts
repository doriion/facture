"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type InterventionSignature = {
  id: string;
  role: "operateur" | "detenteur";
  signataire_nom: string;
  signataire_qualite: string | null;
  signe_le: string;
  url: string;
  /** Nombre total de versions enregistrées pour ce rôle */
  versions: number;
};

const ROLES = ["operateur", "detenteur"] as const;

/**
 * Enregistre une signature (image PNG du canvas) pour une intervention.
 *
 * IMMUABLE par conception (valeur probante) : ni la table ni le bucket
 * `signatures` n'ont de policy update/delete — re-signer insère une
 * nouvelle version datée, l'historique est conservé.
 */
export async function uploadInterventionSignatureAction(
  interventionId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const file = formData.get("file");
  const role = formData.get("role") as string;
  const nom = ((formData.get("nom") as string) || "").trim();
  const qualite = ((formData.get("qualite") as string) || "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Signature vide." };
  }
  if (file.size > 1024 * 1024) {
    return { ok: false, error: "Image de signature trop lourde." };
  }
  if (file.type !== "image/png") {
    return { ok: false, error: "Format attendu : PNG." };
  }
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    return { ok: false, error: "Rôle de signataire invalide." };
  }
  if (!nom) {
    return { ok: false, error: "Le nom du signataire est obligatoire." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: itv } = await supabase
    .from("interventions")
    .select("id")
    .eq("id", interventionId)
    .maybeSingle();
  if (!itv) return { ok: false, error: "Intervention introuvable." };

  const path = `${user.id}/${interventionId}/signature-${role}-${Date.now()}.png`;
  const { error: uploadErr } = await supabase.storage
    .from("signatures")
    .upload(path, file, { contentType: "image/png", upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data, error: dbErr } = await supabase
    .from("intervention_signatures")
    .insert({
      user_id: user.id,
      intervention_id: interventionId,
      role,
      signataire_nom: nom.slice(0, 200),
      signataire_qualite: qualite ? qualite.slice(0, 200) : null,
      storage_path: path,
    })
    .select("id")
    .single();
  if (dbErr || !data) {
    // L'image orpheline restera dans le bucket (pas de policy delete —
    // choix assumé pour l'immuabilité) ; l'entrée base fait foi.
    return { ok: false, error: dbErr?.message ?? "Erreur enregistrement." };
  }

  revalidatePath(`/interventions/${interventionId}`);
  return { ok: true, data: { id: data.id } };
}

/**
 * Dernière signature par rôle (avec URL signée 1 h) + nombre de
 * versions. Les versions précédentes restent en base et dans le
 * Storage (historique probant).
 */
export async function listInterventionSignatures(
  interventionId: string,
): Promise<{
  operateur: InterventionSignature | null;
  detenteur: InterventionSignature | null;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from("intervention_signatures")
    .select("id, role, signataire_nom, signataire_qualite, storage_path, signe_le")
    .eq("intervention_id", interventionId)
    .order("signe_le", { ascending: false });

  const rows = data ?? [];
  const result: {
    operateur: InterventionSignature | null;
    detenteur: InterventionSignature | null;
  } = { operateur: null, detenteur: null };

  for (const role of ROLES) {
    const ofRole = rows.filter((r) => r.role === role);
    const latest = ofRole[0];
    if (!latest) continue;
    const { data: signed } = await supabase.storage
      .from("signatures")
      .createSignedUrl(latest.storage_path, 3600);
    result[role] = {
      id: latest.id,
      role,
      signataire_nom: latest.signataire_nom,
      signataire_qualite: latest.signataire_qualite,
      signe_le: latest.signe_le,
      url: signed?.signedUrl ?? "",
      versions: ofRole.length,
    };
  }
  return result;
}
