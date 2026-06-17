/**
 * Identifiant stable d'un évènement externe (RDV iPhone iCloud /
 * Google Calendar publié) pour persister son lien avec une facture.
 *
 * Stratégie :
 * - Clé primaire = UID iCal (RFC 5545 § 3.8.4.7). Toujours présent
 *   dans les flux iCloud et Google publiés ; stable même quand le
 *   client déplace l'évènement dans son calendrier source.
 * - Clé de secours = hash SHA-256 hex tronqué de "date_start|title".
 *   Recalculable côté agenda, sert si jamais l'UID disparaît ou change
 *   (rare, mais arrivé sur certaines configs où le calendrier est
 *   reconstruit côté serveur Apple).
 *
 * On stocke les DEUX dans facture_external_events et on matche par
 * external_uid en priorité, fallback_key sinon.
 */

import { createHash } from "node:crypto";

export type ExternalEventKeyInput = {
  uid: string;
  date_start: string; // YYYY-MM-DD
  title: string;
};

export type ExternalEventKey = {
  external_uid: string;
  fallback_key: string;
};

/**
 * Renvoie les deux clés pour un évènement externe donné. Côté serveur
 * uniquement (utilise node:crypto).
 */
export function computeExternalEventKey(
  event: ExternalEventKeyInput,
): ExternalEventKey {
  const normalizedUid = event.uid.trim();
  // Si l'UID est vide ou suspicieusement court, on fabrique un UID
  // déterministe basé sur le fallback. Ça reste stable tant que la
  // date et le titre ne bougent pas.
  const fallback = computeFallbackKey(event.date_start, event.title);
  const external_uid = normalizedUid.length >= 4 ? normalizedUid : fallback;
  return {
    external_uid,
    fallback_key: fallback,
  };
}

function computeFallbackKey(dateStart: string, title: string): string {
  const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, " ");
  const raw = `${dateStart}|${normalizedTitle}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}
