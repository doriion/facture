"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { cheminVignette, urlsPhotos } from "@/lib/photos-vignettes";

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
  /** Vignette (≈ 400 px) signée, null pour les photos d'avant les vignettes. */
  urlMin: string | null;
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
  const vignette = formData.get("vignette");
  const moment = (formData.get("moment") as string) || "autre";
  const legende = ((formData.get("legende") as string) || "").trim();
  const idBrut = formData.get("id");
  const idClient = typeof idBrut === "string" && /^[0-9a-f-]{36}$/i.test(idBrut) ? idBrut : null;

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // Rejeu d'une photo déjà reçue (file d'attente hors ligne) : succès.
  if (idClient) {
    const { data: deja } = await supabase
      .from("intervention_photos")
      .select("id")
      .eq("id", idClient)
      .maybeSingle();
    if (deja) return { ok: true, data: { id: deja.id } };
  }

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
  // Vignette (réduite sur le téléphone) : une commodité d'affichage,
  // son échec n'empêche pas la photo.
  if (vignette instanceof File && vignette.size > 0 && vignette.size <= 2 * 1024 * 1024) {
    await supabase.storage
      .from("intervention-photos")
      .upload(cheminVignette(path), vignette, { contentType: "image/jpeg", upsert: true });
  }

  const { data, error: dbErr } = await supabase
    .from("intervention_photos")
    .insert({
      ...(idClient ? { id: idClient } : {}),
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("intervention_photos")
    .select("*")
    .eq("intervention_id", interventionId)
    .order("ordre", { ascending: true });

  if (!data) return [];

  const paths = data.map((p) => p.storage_path);
  // Originales et vignettes signées en un lot (une vignette absente
  // n'est pas une erreur : photo d'avant les vignettes).
  const { data: signed } = await supabase.storage
    .from("intervention-photos")
    .createSignedUrls([...paths, ...paths.map(cheminVignette)], 3600);
  const urls = urlsPhotos(paths, signed ?? []);

  return data.map((p) => ({
    id: p.id,
    intervention_id: p.intervention_id,
    storage_path: p.storage_path,
    legende: p.legende,
    moment: p.moment,
    ordre: p.ordre,
    url: urls.get(p.storage_path)?.url ?? "",
    urlMin: urls.get(p.storage_path)?.urlMin ?? null,
  }));
}

/**
 * Supprime une photo (storage + base).
 */
export async function deleteInterventionPhotoAction(
  photoId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("intervention_photos")
    .select("storage_path, intervention_id")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Photo introuvable." };

  await supabase.storage
    .from("intervention-photos")
    .remove([photo.storage_path, cheminVignette(photo.storage_path)]);

  const { error } = await supabase
    .from("intervention_photos")
    .delete()
    .eq("id", photoId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/interventions/${photo.intervention_id}`);
  return { ok: true, data: undefined };
}
