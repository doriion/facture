/**
 * Validation du paramètre `?next=` utilisé pour revenir à la page
 * demandée après connexion. Helper PUR (testable unitairement).
 *
 * Règles anti open-redirect : on n'accepte QUE des chemins internes —
 * jamais une URL externe, jamais de protocole, jamais `//hôte` ni
 * `/\hôte` (les navigateurs assimilent le backslash à un slash).
 */

const FALLBACK = "/dashboard";

export function sanitizeNextPath(next: unknown): string {
  if (typeof next !== "string" || next.length === 0) return FALLBACK;
  // Chemin interne uniquement : commence par exactement UN "/"
  if (!next.startsWith("/") || next.startsWith("//")) return FALLBACK;
  // "/\evil.com" est interprété "//evil.com" par les navigateurs
  if (next.includes("\\")) return FALLBACK;
  // Caractères de contrôle (CR/LF injection, etc.)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(next)) return FALLBACK;
  // Éviter les boucles de connexion
  if (
    next === "/login" ||
    next.startsWith("/login/") ||
    next.startsWith("/login?")
  ) {
    return FALLBACK;
  }
  return next;
}
