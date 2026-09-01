/**
 * Masquage des données personnelles avant envoi à Sentry — PUR, testé.
 *
 * Règle du lot : AUCUNE donnée client dans les rapports d'erreur.
 * On masque dans les messages d'erreur : adresses email, numéros de
 * téléphone FR, montants en euros, et IBAN. Les noms ne peuvent pas
 * être reconnus par motif — la protection principale est de ne jamais
 * mettre de nom de client dans un message d'erreur (revue de code) et
 * de ne pas envoyer les corps de requête (beforeSend supprime request
 * et user).
 */

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Montants : 1 234,56 € / 1234.56€ / 40 € (espace insécable incluse)
const MONTANT = /\d[\d\s  ]*(?:[.,]\d{1,2})?\s*€/g;
// Téléphones FR : 06 12 34 56 78, +33612345678, 06.12.34.56.78…
const TELEPHONE = /(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g;
// Pas de \s en fin de motif : l'espace suivant l'IBAN doit survivre
const IBAN = /\bFR\d{2}(?:\s?[\dA-Z]){11,30}\b/g;

export function masquerPII(texte: string): string {
  return texte
    .replace(IBAN, "[iban]")
    .replace(EMAIL, "[email]")
    .replace(TELEPHONE, "[tel]")
    .replace(MONTANT, "[montant]");
}

/**
 * Nettoie un événement Sentry (forme minimale commune aux SDK) :
 * - supprime user, request (corps, cookies, en-têtes) et les
 *   breadcrumbs porteurs de données ;
 * - masque emails/montants/téléphones/IBAN dans message et exceptions.
 * Typé « structurel » pour rester testable sans importer Sentry.
 */
export function nettoyerEvenementSentry<
  E extends {
    user?: unknown;
    request?: { url?: string } | undefined;
    message?: string;
    breadcrumbs?: Array<{ message?: string; data?: unknown }>;
    exception?: {
      values?: Array<{ value?: string }>;
    };
  },
>(event: E): E {
  delete event.user;
  if (event.request) {
    // On ne garde que l'URL (chemin utile au debug, sans query string)
    const url = event.request.url?.split("?")[0];
    event.request = url ? ({ url } as E["request"]) : undefined;
  }
  if (event.message) {
    event.message = masquerPII(event.message);
  }
  if (event.exception?.values) {
    for (const v of event.exception.values) {
      if (v.value) v.value = masquerPII(v.value);
    }
  }
  if (event.breadcrumbs) {
    for (const b of event.breadcrumbs) {
      if (b.message) b.message = masquerPII(b.message);
      delete b.data;
    }
  }
  return event;
}
