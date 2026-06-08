"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type InterventionPhoto = {
  id: string;
  intervention_id: string;
  storage_path: string;
  legende: string | null;
  moment: string | null;
  ordre: number;
  url: string; // URL signée à utilisation
};

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/**
 * Upload une photo pour une intervention. Le fichier est rangé sous
 * `{user_id}/{intervention_id}/{timestamp}.{ext}` dans le bucket
 * `intervention-photos`. Une entrée correspondante est créée en base.
 */
export async function uploadInterventionPhotoAction(
  interventionId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const file = formData.get("file");
  const moment = (formData.get("moment") as string) || "autre";
  const legende = ((formData.get("legende") as string) || "").trim();

  if (!(file instanceof File)) {
    return { ok: false, error: "Aucun fichier fourni." };
  }
  if (file.size === 0) return { ok: false, error: "Fichier vide." };
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "Photo trop lourde (max 10 Mo)." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "Format non supporté (JPG, PNG, WebP, HEIC).",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // Vérifie que l'intervention appartient à l'utilisateur (RLS le ferait
  // aussi mais on évite un upload inutile en cas d'ID frauduleux).
  const { data: itv } = await supabase
    .from("interventions")
    .select("id")
    .eq("id", interventionId)
    .maybeSingle();
  if (!itv) return { ok: false, error: "Intervention introuvable." };

  // Ordre = max existant + 1
  const { data: existing } = await supabase
    .from("intervention_photos")
    .select("ordre")
    .eq("intervention_id", interventionId)
    .order("ordre", { ascending: false })
    .limit(1);
  const nextOrdre = ((existing?.[0]?.ordre as number | undefined) ?? -1) + 1;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${interventionId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("intervention-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data, error: dbErr } = await supabase
    .from("intervention_photos")
    .insert({
      user_id: user.id,
      intervention_id: interventionId,
      storage_path: path,
      legende: legende || null,
      moment: ["avant", "pendant", "apres", "autre"].includes(moment)
        ? moment
        : "autre",
      ordre: nextOrdre,
    })
    .select("id")
    .single();

  if (dbErr || !data) {
    // Cleanup orphan storage
    await supabase.storage.from("intervention-photos").remove([path]);
    return {
      ok: false,
      error: dbErr?.message ?? "Erreur enregistrement.",
    };
  }

  revalidatePath(`/interventions/${interventionId}`);
  return { ok: true, data: { id: data.id } };
}

/**
 * Liste les photos d'une intervention avec une URL signée (1h) pour
 * affichage immédiat. Retourne un tableau vide en cas d'erreur.
 */
export async function listInterventionPhotos(
  interventionId: string,
): Promise<InterventionPhoto[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("intervention_photos")
    .select("*")
    .eq("intervention_id", interventionId)
    .order("ordre", { ascending: true });

  if (!data) return [];

  const paths = data.map((p) => p.storage_path);
  const { data: signed } = await supabase.storage
    .from("intervention-photos")
    .createSignedUrls(paths, 3600);

  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  }

  return data.map((p) => ({
    id: p.id,
    intervention_id: p.intervention_id,
    storage_path: p.storage_path,
    legende: p.legende,
    moment: p.moment,
    ordre: p.ordre,
    url: urlByPath.get(p.storage_path) ?? "",
  }));
}

/**
 * Supprime une photo (storage + base).
 */
export async function deleteInterventionPhotoAction(
  photoId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: photo } = await supabase
    .from("intervention_photos")
    .select("storage_path, intervention_id")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Photo introuvable." };

  await supabase.storage
    .from("intervention-photos")
    .remove([photo.storage_path]);

  const { error } = await supabase
    .from("intervention_photos")
    .delete()
    .eq("id", photoId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/interventions/${photo.intervention_id}`);
  return { ok: true, data: undefined };
}

/**
 * Met à jour légende ou moment d'une photo.
 */
export async function updateInterventionPhotoAction(
  photoId: string,
  patch: { legende?: string; moment?: string },
): Promise<ActionResult> {
  const supabase = createClient();
  const update: { legende?: string | null; moment?: string } = {};
  if (patch.legende !== undefined) {
    update.legende = patch.legende.trim() || null;
  }
  if (patch.moment !== undefined) {
    if (!["avant", "pendant", "apres", "autre"].includes(patch.moment)) {
      return { ok: false, error: "Moment invalide." };
    }
    update.moment = patch.moment;
  }
  const { data: photo, error } = await supabase
    .from("intervention_photos")
    .update(update)
    .eq("id", photoId)
    .select("intervention_id")
    .single();
  if (error || !photo) {
    return { ok: false, error: error?.message ?? "Erreur." };
  }
  revalidatePath(`/interventions/${photo.intervention_id}`);
  return { ok: true, data: undefined };
}
