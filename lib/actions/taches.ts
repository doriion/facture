"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { formatDateFr } from "@/lib/format";
import { aujourdhuiParis, classerTaches } from "@/lib/taches-logic";
import { tacheSchema, type TacheFormInput } from "@/lib/validations/tache";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type TachePhoto = {
  id: string;
  storage_path: string;
  url: string; // URL signée 1 h
};

export type LienTache = {
  type: "client" | "intervention" | "devis" | "facture";
  label: string;
  href: string;
};

export type TacheAvecDetails = {
  id: string;
  titre: string;
  notes: string | null;
  date_echeance: string | null;
  /** HH:MM (tronquée depuis le type time de Postgres) */
  heure: string | null;
  priorite: string;
  fait: boolean;
  fait_le: string | null;
  created_at: string;
  lien: LienTache | null;
  photos: TachePhoto[];
};

type LigneJointe = {
  id: string;
  titre: string;
  notes: string | null;
  date_echeance: string | null;
  heure: string | null;
  priorite: string;
  fait: boolean;
  fait_le: string | null;
  created_at: string;
  client_id: string | null;
  intervention_id: string | null;
  devis_id: string | null;
  facture_id: string | null;
  client: { nom: string } | null;
  intervention: { date_intervention: string; type: string } | null;
  devis: { numero: string } | null;
  facture: { numero: string } | null;
};

function construireLien(t: LigneJointe): LienTache | null {
  if (t.facture_id && t.facture) {
    return {
      type: "facture",
      label: `Facture ${t.facture.numero}`,
      href: `/factures/${t.facture_id}`,
    };
  }
  if (t.devis_id && t.devis) {
    return {
      type: "devis",
      label: `Devis ${t.devis.numero}`,
      href: `/devis/${t.devis_id}`,
    };
  }
  if (t.intervention_id && t.intervention) {
    return {
      type: "intervention",
      label: `Intervention du ${formatDateFr(t.intervention.date_intervention)}`,
      href: `/interventions/${t.intervention_id}`,
    };
  }
  if (t.client_id && t.client) {
    return {
      type: "client",
      label: t.client.nom,
      href: `/clients/${t.client_id}`,
    };
  }
  return null;
}

/**
 * Toutes les tâches de l'utilisateur (faites comprises — le filtrage
 * 30 jours des « Faites » est fait par la logique de classement), avec
 * le libellé du document lié et les photos (URLs signées en un lot).
 */
export async function getTaches(): Promise<TacheAvecDetails[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("taches")
    .select(
      "id, titre, notes, date_echeance, heure, priorite, fait, fait_le, created_at, client_id, intervention_id, devis_id, facture_id, client:clients(nom), intervention:interventions(date_intervention, type), devis:devis(numero), facture:factures(numero)",
    )
    .order("created_at", { ascending: false });

  const lignes = (data ?? []) as unknown as LigneJointe[];
  if (lignes.length === 0) return [];

  // Photos de toutes les tâches en deux requêtes (select + URLs signées)
  const { data: photos } = await supabase
    .from("taches_photos")
    .select("id, tache_id, storage_path")
    .in(
      "tache_id",
      lignes.map((t) => t.id),
    )
    .order("ordre", { ascending: true });

  const urlByPath = new Map<string, string>();
  const paths = (photos ?? []).map((p) => p.storage_path);
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("taches-photos")
      .createSignedUrls(paths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  const photosParTache = new Map<string, TachePhoto[]>();
  for (const p of photos ?? []) {
    const liste = photosParTache.get(p.tache_id) ?? [];
    liste.push({
      id: p.id,
      storage_path: p.storage_path,
      url: urlByPath.get(p.storage_path) ?? "",
    });
    photosParTache.set(p.tache_id, liste);
  }

  return lignes.map((t) => ({
    id: t.id,
    titre: t.titre,
    notes: t.notes,
    date_echeance: t.date_echeance,
    heure: t.heure ? t.heure.slice(0, 5) : null,
    priorite: t.priorite,
    fait: t.fait,
    fait_le: t.fait_le,
    created_at: t.created_at,
    lien: construireLien(t),
    photos: photosParTache.get(t.id) ?? [],
  }));
}

/**
 * Compteur du badge de navigation : tâches non faites, échues
 * aujourd'hui ou en retard (les sans-date ne comptent pas). Une seule
 * requête count head — appelée par le layout à chaque navigation.
 */
export async function getCompteurBadgeTaches(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("taches")
    .select("id", { count: "exact", head: true })
    .eq("fait", false)
    .not("date_echeance", "is", null)
    .lte("date_echeance", aujourdhuiParis());
  return count ?? 0;
}

export type TacheDuJour = {
  id: string;
  titre: string;
  date_echeance: string | null;
  heure: string | null;
  priorite: string;
  joursRetard: number;
};

/**
 * Tâches échues aujourd'hui + en retard, pour le bloc « À faire
 * aujourd'hui » du dashboard (léger : pas de photos ni de liens).
 */
export async function getTachesDuJour(): Promise<TacheDuJour[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("taches")
    .select("id, titre, date_echeance, heure, priorite, fait, fait_le")
    .eq("fait", false)
    .not("date_echeance", "is", null);

  const { enRetard, aujourdhui } = classerTaches(
    (data ?? []).map((t) => ({ ...t, heure: t.heure?.slice(0, 5) ?? null })),
    aujourdhuiParis(),
  );
  return [
    ...enRetard.map((t) => ({
      id: t.id,
      titre: t.titre,
      date_echeance: t.date_echeance,
      heure: t.heure,
      priorite: t.priorite,
      joursRetard: t.joursRetard,
    })),
    ...aujourdhui.map((t) => ({
      id: t.id,
      titre: t.titre,
      date_echeance: t.date_echeance,
      heure: t.heure,
      priorite: t.priorite,
      joursRetard: 0,
    })),
  ];
}

export async function createTacheAction(
  input: TacheFormInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = tacheSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Saisie invalide.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data, error } = await supabase
    .from("taches")
    .insert({
      user_id: user.id,
      titre: v.titre,
      notes: v.notes || null,
      date_echeance: v.date_echeance || null,
      // L'heure sans date n'a pas de sens : on ne la garde qu'avec une date
      heure: v.date_echeance && v.heure ? v.heure : null,
      priorite: v.priorite,
      client_id: v.client_id || null,
      intervention_id: v.intervention_id || null,
      devis_id: v.devis_id || null,
      facture_id: v.facture_id || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur d'enregistrement." };
  }

  revalidatePath("/taches");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

/** Coche / décoche une tâche (fait + horodatage de réalisation). */
export async function setTacheFaitAction(
  id: string,
  fait: boolean,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("taches")
    .update({
      fait,
      fait_le: fait ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/taches");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

/** Supprime une tâche et ses photos (storage + base, cascade). */
export async function deleteTacheAction(id: string): Promise<ActionResult> {
  const supabase = createClient();

  const { data: photos } = await supabase
    .from("taches_photos")
    .select("storage_path")
    .eq("tache_id", id);
  if (photos && photos.length > 0) {
    await supabase.storage
      .from("taches-photos")
      .remove(photos.map((p) => p.storage_path));
  }

  const { error } = await supabase.from("taches").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/taches");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/**
 * Upload d'une photo de tâche — même modèle que les photos
 * d'interventions : fichier rangé sous `{user_id}/{tache_id}/…` dans le
 * bucket privé `taches-photos`, entrée en base, cleanup si l'insert échoue.
 */
export async function uploadTachePhotoAction(
  tacheId: string,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Aucun fichier fourni." };
  }
  if (file.size === 0) return { ok: false, error: "Fichier vide." };
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "Photo trop lourde (max 10 Mo)." };
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Format non supporté (JPG, PNG, WebP, HEIC)." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: tache } = await supabase
    .from("taches")
    .select("id")
    .eq("id", tacheId)
    .maybeSingle();
  if (!tache) return { ok: false, error: "Tâche introuvable." };

  const { data: existing } = await supabase
    .from("taches_photos")
    .select("ordre")
    .eq("tache_id", tacheId)
    .order("ordre", { ascending: false })
    .limit(1);
  const nextOrdre = ((existing?.[0]?.ordre as number | undefined) ?? -1) + 1;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${tacheId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("taches-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data, error: dbErr } = await supabase
    .from("taches_photos")
    .insert({
      user_id: user.id,
      tache_id: tacheId,
      storage_path: path,
      ordre: nextOrdre,
    })
    .select("id")
    .single();

  if (dbErr || !data) {
    await supabase.storage.from("taches-photos").remove([path]);
    return { ok: false, error: dbErr?.message ?? "Erreur enregistrement." };
  }

  revalidatePath("/taches");
  return { ok: true, data: { id: data.id } };
}

export async function deleteTachePhotoAction(
  photoId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: photo } = await supabase
    .from("taches_photos")
    .select("storage_path")
    .eq("id", photoId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Photo introuvable." };

  await supabase.storage.from("taches-photos").remove([photo.storage_path]);

  const { error } = await supabase
    .from("taches_photos")
    .delete()
    .eq("id", photoId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/taches");
  return { ok: true, data: undefined };
}
