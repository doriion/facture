import "server-only";

import webpush from "web-push";

import type { ContenuPush } from "@/lib/rappels-push";

/**
 * Envoi Web Push (VAPID). Variables Vercel requises :
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  — clé publique (aussi lue côté navigateur)
 *   VAPID_PRIVATE_KEY             — clé privée (serveur seulement)
 *   VAPID_SUBJECT                 — URL de l'app ou mailto: (contact)
 */
export function pushConfigure(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

let configure = false;
function preparer() {
  if (configure) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "https://facture-green.vercel.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configure = true;
}

export type AbonnementPush = { endpoint: string; p256dh: string; auth: string };

export type ResultatEnvoi = "ok" | "expire" | "erreur";

/**
 * Envoie une notification à UN appareil. « expire » = l'abonnement
 * n'existe plus côté navigateur (404 / 410) : l'appelant le supprime.
 */
export async function envoyerNotification(
  abonnement: AbonnementPush,
  contenu: ContenuPush,
): Promise<{ resultat: ResultatEnvoi; erreur?: string }> {
  if (!pushConfigure()) return { resultat: "erreur", erreur: "Clés VAPID manquantes." };
  preparer();
  try {
    await webpush.sendNotification(
      { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.p256dh, auth: abonnement.auth } },
      JSON.stringify(contenu),
      { TTL: 60 * 60, urgency: "high" },
    );
    return { resultat: "ok" };
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return { resultat: "expire" };
    return { resultat: "erreur", erreur: e instanceof Error ? e.message : String(e) };
  }
}
