import "server-only";

import { headers } from "next/headers";

/**
 * Adresse publique du site, pour les liens envoyés par e-mail :
 * NEXT_PUBLIC_APP_URL d'abord (jamais dépendante d'un en-tête), l'hôte
 * de la requête en repli, puis l'adresse de production connue (tâches
 * planifiées : il n'y a pas de requête).
 */
export async function baseUrlPublique(): Promise<string> {
  const env = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (env) return env;
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    if (host) return `${proto}://${host}`;
  } catch {
    // Hors requête (cron) : pas d'en-têtes.
  }
  return (process.env.VAPID_SUBJECT ?? "").startsWith("https://")
    ? process.env.VAPID_SUBJECT!.replace(/\/$/, "")
    : "https://facture-green.vercel.app";
}
