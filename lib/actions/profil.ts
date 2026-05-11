"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { profilSchema, type ProfilFormValues } from "@/lib/validations/profil";
import { siretToSiren, stripSpaces } from "@/lib/format";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Récupère le profil entreprise de l'utilisateur connecté.
 * Renvoie null s'il n'a jamais été créé (premier passage sur Paramètres).
 */
export async function getProfil() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profil_entreprise")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return data;
}

/**
 * Crée ou met à jour le profil. Le SIREN est dérivé automatiquement du SIRET.
 * Les chaînes vides sont normalisées en null pour cohérence en base.
 */
export async function upsertProfil(
  values: ProfilFormValues,
): Promise<ActionResult> {
  const parsed = profilSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const v = parsed.data;
  // Normalisation : "" → null + nettoyage espaces
  const cleanedSiret = v.siret ? stripSpaces(v.siret) : null;
  const cleanedIban = v.iban ? stripSpaces(v.iban).toUpperCase() : null;
  const cleanedBic = v.bic ? stripSpaces(v.bic).toUpperCase() : null;

  const payload = {
    user_id: user.id,
    nom: v.nom || null,
    prenom: v.prenom || null,
    nom_commercial: v.nom_commercial || null,
    siret: cleanedSiret,
    siren: siretToSiren(cleanedSiret),
    code_ape: v.code_ape ? v.code_ape.toUpperCase() : null,
    num_rm: v.num_rm || null,
    adresse_ligne1: v.adresse_ligne1 || null,
    adresse_ligne2: v.adresse_ligne2 || null,
    code_postal: v.code_postal || null,
    ville: v.ville || null,
    pays: v.pays || "France",
    email_pro: v.email_pro || null,
    telephone: v.telephone || null,
    site_web: v.site_web || null,
    num_assurance_decennale: v.num_assurance_decennale || null,
    assureur_decennale: v.assureur_decennale || null,
    zone_couverture_decennale: v.zone_couverture_decennale || null,
    num_attestation_fluides_frigo: v.num_attestation_fluides_frigo || null,
    num_rge_qualipac: v.num_rge_qualipac || null,
    iban: cleanedIban,
    bic: cleanedBic,
    banque_nom: v.banque_nom || null,
    mediateur_nom: v.mediateur_nom || null,
    mediateur_site_web: v.mediateur_site_web || null,
    mediateur_adresse: v.mediateur_adresse || null,
    conditions_paiement_default: v.conditions_paiement_default || null,
    penalites_retard_text: v.penalites_retard_text || null,
    escompte_text: v.escompte_text || null,
  };

  const { error } = await supabase
    .from("profil_entreprise")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/parametres");
  return { ok: true, data: undefined };
}

/**
 * Upload du logo dans le bucket privé `logos/{user_id}/logo-{ts}.{ext}`.
 * Le stockage utilise le préfixe user_id pour respecter les policies RLS.
 * Renvoie le path interne (réutilisé pour générer une URL signée).
 */
export async function uploadLogo(formData: FormData): Promise<ActionResult<string>> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Aucun fichier fourni." };
  }
  if (file.size === 0) {
    return { ok: false, error: "Fichier vide." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: "Logo trop lourd (max 2 Mo)." };
  }
  if (!["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Format non supporté (PNG, JPG, SVG, WebP)." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${user.id}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  // On enregistre directement le path interne ; l'affichage utilise une
  // URL signée générée à la volée côté composant serveur (cf. logo-display).
  const { error: updateError } = await supabase
    .from("profil_entreprise")
    .upsert(
      { user_id: user.id, logo_url: path },
      { onConflict: "user_id" },
    );

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/parametres");
  return { ok: true, data: path };
}

/**
 * Supprime le logo (storage + référence en base).
 */
export async function removeLogo(): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: profil } = await supabase
    .from("profil_entreprise")
    .select("logo_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profil?.logo_url) {
    await supabase.storage.from("logos").remove([profil.logo_url]);
  }

  await supabase
    .from("profil_entreprise")
    .update({ logo_url: null })
    .eq("user_id", user.id);

  revalidatePath("/parametres");
  return { ok: true, data: undefined };
}

/**
 * Génère une URL signée pour afficher le logo (1h de validité).
 * À appeler côté serveur uniquement.
 */
export async function getLogoUrl(path: string | null | undefined) {
  if (!path) return null;
  const supabase = createClient();
  const { data } = await supabase.storage
    .from("logos")
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/**
 * Renvoie le token iCal de l'utilisateur, en le créant s'il n'existe pas.
 * Si `regenerate = true`, force la regénération (invalide l'URL précédente).
 */
export async function getOrCreateCalendarToken(
  regenerate = false,
): Promise<ActionResult<string>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("ensure_calendar_token", {
    p_force: regenerate,
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Échec." };
  }
  if (regenerate) {
    revalidatePath("/parametres");
  }
  return { ok: true, data };
}
