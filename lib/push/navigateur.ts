"use client";

/**
 * Côté navigateur : abonnement Web Push de CET appareil.
 *
 * Sur iPhone, les notifications ne marchent que pour l'app AJOUTÉE À
 * L'ÉCRAN D'ACCUEIL (iOS 16.4+), pas depuis Safari. Sur Android /
 * Chrome, depuis le navigateur ou l'app installée.
 */

export type EtatPush =
  | "non-supporte"
  | "safari-non-installe"
  | "refuse"
  | "pret";

export function etatPush(): EtatPush {
  if (typeof window === "undefined") return "non-supporte";
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const installee =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // iPhone : Safari n'expose les notifications qu'à l'app installée.
  if (iOS && !installee) return "safari-non-installe";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "non-supporte";
  }
  if (Notification.permission === "denied") return "refuse";
  return "pret";
}

/** Un nom lisible de l'appareil pour la liste des réglages. */
export function nomAppareil(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "PC Windows";
  return "Navigateur";
}

function base64VersUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalise = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = window.atob(normalise);
  const sortie = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) sortie[i] = brut.charCodeAt(i);
  return sortie;
}

export type AbonnementNavigateur = { endpoint: string; p256dh: string; auth: string };

function versAbonnement(sub: PushSubscription): AbonnementNavigateur | null {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/** Abonnement déjà présent sur cet appareil (sans rien demander). */
export async function abonnementExistant(): Promise<AbonnementNavigateur | null> {
  if (etatPush() !== "pret") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? versAbonnement(sub) : null;
}

/**
 * Demande la permission puis s'abonne. À appeler depuis un GESTE de
 * l'utilisateur (tap sur un bouton), sinon iOS refuse.
 */
export async function sAbonner(clePublique: string): Promise<
  { ok: true; abonnement: AbonnementNavigateur } | { ok: false; erreur: string }
> {
  if (!("serviceWorker" in navigator)) return { ok: false, erreur: "Navigateur non compatible." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, erreur: "Notifications refusées sur cet appareil." };
  }
  const reg =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64VersUint8Array(clePublique) as BufferSource,
      }));
    const abonnement = versAbonnement(sub);
    if (!abonnement) return { ok: false, erreur: "Abonnement incomplet renvoyé par le navigateur." };
    return { ok: true, abonnement };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Abonnement impossible." };
  }
}

/** Se désabonne côté navigateur ; renvoie l'endpoint retiré (ou null). */
export async function seDesabonner(): Promise<string | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
