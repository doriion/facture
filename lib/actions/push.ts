"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { envoyerNotification, pushConfigure } from "@/lib/push/envoi";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type AppareilPush = {
  id: string;
  endpoint: string;
  appareil: string | null;
  created_at: string;
  derniere_utilisation: string | null;
};

export type ReglagesRappelsPush = {
  actif: boolean;
  delai_minutes: number;
  /** Clé publique VAPID (vide = push non configuré côté serveur). */
  clePublique: string;
};

const abonnementSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  appareil: z.string().max(120).optional().nullable(),
});

/** Appareils abonnés de l'utilisateur (RLS). */
export async function listAppareilsPush(): Promise<AppareilPush[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("push_abonnements")
    .select("id, endpoint, appareil, created_at, derniere_utilisation")
    .order("created_at", { ascending: true });
  return data ?? [];
}

/**
 * Enregistre (ou rafraîchit) l'abonnement de CET appareil. L'endpoint
 * est unique : un ré-abonnement met à jour les clés.
 */
export async function enregistrerAbonnementPushAction(
  input: z.input<typeof abonnementSchema>,
): Promise<ActionResult> {
  const parsed = abonnementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Abonnement invalide." };
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { error } = await supabase.from("push_abonnements").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      appareil: parsed.data.appareil ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  return { ok: true, data: undefined };
}

/** Retire un appareil (depuis les réglages, ou quand le navigateur se désabonne). */
export async function supprimerAbonnementPushAction(
  endpoint: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("push_abonnements").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  return { ok: true, data: undefined };
}

/** Interrupteur + délai (5 → 1440 min, parmi les choix proposés ou libre). */
export async function saveReglagesRappelsPushAction(input: {
  actif: boolean;
  delai_minutes: number;
}): Promise<ActionResult> {
  const delai = Math.round(Number(input.delai_minutes));
  if (!Number.isFinite(delai) || delai < 5 || delai > 1440) {
    return { ok: false, error: "Délai de rappel : entre 5 min et 24 h." };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  const { error } = await supabase
    .from("profil_entreprise")
    .update({
      auto_rappels_push_active: input.actif === true,
      rappels_push_delai_minutes: delai,
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  return { ok: true, data: undefined };
}

/**
 * Notification de test vers tous les appareils de l'utilisateur —
 * pour vérifier que ça sonne avant de compter dessus.
 */
export async function envoyerPushTestAction(): Promise<
  ActionResult<{ envoyes: number; expires: number }>
> {
  if (!pushConfigure()) {
    return { ok: false, error: "Rappels push non configurés sur le serveur (clés VAPID)." };
  }
  const supabase = createClient();
  const { data: abonnements } = await supabase
    .from("push_abonnements")
    .select("endpoint, p256dh, auth");
  if (!abonnements || abonnements.length === 0) {
    return { ok: false, error: "Aucun appareil abonné." };
  }
  let envoyes = 0;
  let expires = 0;
  let derniereErreur: string | undefined;
  for (const a of abonnements) {
    const r = await envoyerNotification(a, {
      titre: "NG Gestion — test",
      corps: "Les rappels de rendez-vous arriveront comme ceci.",
      url: "/agenda",
      tag: "test",
    });
    if (r.resultat === "ok") envoyes += 1;
    else if (r.resultat === "expire") {
      expires += 1;
      await supabase.from("push_abonnements").delete().eq("endpoint", a.endpoint);
    } else derniereErreur = r.erreur;
  }
  if (envoyes === 0) {
    return { ok: false, error: derniereErreur ?? "Aucun appareil joignable (abonnements expirés retirés)." };
  }
  revalidatePath("/parametres");
  return { ok: true, data: { envoyes, expires } };
}
