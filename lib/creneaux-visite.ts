/**
 * Créneaux de visite d'entretien — logique PURE, testée dans
 * creneaux-visite.test.ts : créneaux libres de l'agenda (demi-journées
 * ouvrées sans rendez-vous), libellés, état d'une proposition envoyée
 * au client, et validation de sa réponse.
 */

import { z } from "zod";

import { ajouterJours, depuisYmd, libelleJourLong } from "@/lib/agenda-vues";
import { horairesParDefaut, type HorairesVisites } from "@/lib/horaires-visites";
import { heureLisible } from "@/lib/visite-entretien";

/** Un créneau : une date, et des heures (null = dans la journée). */
export type Creneau = { date: string; debut: string | null; fin: string | null };

/** Un rendez-vous déjà posé (intervention, visite planifiée…). */
export type Occupation = {
  date_start: string;
  date_end: string;
  heure_debut: string | null;
  heure_fin: string | null;
};

/** Demi-journées proposées aux clients, d'après les horaires de l'artisan. */
export function tranchesDe(horaires: HorairesVisites = horairesParDefaut()): Array<{ debut: string; fin: string }> {
  return [horaires.matin, horaires.apres_midi].filter((t): t is { debut: string; fin: string } => Boolean(t));
}

/** Durée supposée d'un rendez-vous sans heure de fin. */
const DUREE_SANS_FIN_MIN = 60;

function minutes(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

/** Jour travaillé (1 = lundi … 7 = dimanche ; défaut lundi à vendredi). */
export function estJourOuvre(ymd: string, jours: number[] = horairesParDefaut().jours): boolean {
  const j = depuisYmd(ymd).getDay();
  return jours.includes(j === 0 ? 7 : j);
}

/** Le rendez-vous couvre-t-il ce créneau (même partiellement) ? */
export function creneauOccupe(c: Creneau, occupations: Occupation[]): boolean {
  return occupations.some((o) => {
    if (o.date_start > c.date || o.date_end < c.date) return false;
    // Journée entière (sans heure), ou créneau « dans la journée » : tout bloque.
    if (!o.heure_debut || !c.debut || !c.fin) return true;
    const oDebut = minutes(o.heure_debut);
    const oFin = o.heure_fin ? minutes(o.heure_fin) : oDebut + DUREE_SANS_FIN_MIN;
    return oDebut < minutes(c.fin) && oFin > minutes(c.debut);
  });
}

export function memeCreneau(a: Creneau, b: Creneau): boolean {
  return a.date === b.date && (a.debut ?? null) === (b.debut ?? null);
}

/**
 * Demi-journées ouvrées libres entre deux dates (incluses), dans
 * l'ordre, au plus `max`. `exclure` retire un créneau (celui déjà
 * proposé en premier).
 */
export function creneauxLibres(args: {
  depuis: string;
  jusquau: string;
  occupations: Occupation[];
  max?: number;
  exclure?: Creneau | null;
  /** Horaires de l'artisan (Paramètres) ; défaut lundi–vendredi, 8–12 h et 14–18 h. */
  horaires?: HorairesVisites;
}): Creneau[] {
  const max = args.max ?? 6;
  const horaires = args.horaires ?? horairesParDefaut();
  const tranches = tranchesDe(horaires);
  const resultat: Creneau[] = [];
  for (let d = args.depuis; d <= args.jusquau && resultat.length < max; d = ajouterJours(d, 1)) {
    if (!estJourOuvre(d, horaires.jours)) continue;
    for (const t of tranches) {
      const c: Creneau = { date: d, debut: t.debut, fin: t.fin };
      if (args.exclure && memeCreneau(c, args.exclure)) continue;
      if (creneauOccupe(c, args.occupations)) continue;
      resultat.push(c);
      if (resultat.length >= max) break;
    }
  }
  return resultat;
}

/**
 * « le matin (8 h – 12 h) », « l'après-midi (14 h – 18 h) » pour une
 * demi-journée (3 h ou plus), « entre 9 h 30 et 11 h 30 » pour un créneau
 * court, « à 9 h 30 » sans fin, « dans la journée » sans heure.
 */
export function libellePlage(c: Creneau): string {
  if (!c.debut) return "dans la journée";
  const debut = heureLisible(c.debut)!;
  if (!c.fin) return `à ${debut}`;
  const duree = minutes(c.fin) - minutes(c.debut);
  if (duree >= 180) {
    const periode = c.debut < "12:00" ? "le matin" : "l'après-midi";
    return `${periode} (${debut} – ${heureLisible(c.fin)})`;
  }
  return `entre ${debut} et ${heureLisible(c.fin)}`;
}

/** « Mardi 15 octobre 2026, le matin (8 h – 12 h) ». */
export function libelleCreneau(c: Creneau): string {
  return `${libelleJourLong(c.date)}, ${libellePlage(c)}`;
}

/** Le créneau proposé par l'artisan (heure précise ou journée). */
export function creneauPropose(date: string, heure: string | null): Creneau {
  if (!heure) return { date, debut: null, fin: null };
  const debut = heure.slice(0, 5);
  const fin = Math.min(minutes(debut) + 120, 23 * 60 + 59);
  return { date, debut, fin: `${String(Math.floor(fin / 60)).padStart(2, "0")}:${String(fin % 60).padStart(2, "0")}` };
}

/** Durée de validité du lien de réponse. */
export const DUREE_LIEN_JOURS = 30;

export function expirationProposition(envoyeeLeIso: string): string {
  const d = new Date(envoyeeLeIso);
  d.setUTCDate(d.getUTCDate() + DUREE_LIEN_JOURS);
  return d.toISOString();
}

export type EtatProposition = "utilisable" | "repondue" | "annulee" | "expiree" | "introuvable";

/**
 * État du lien public : utilisable tant que le client n'a pas répondu,
 * que le lien n'a pas expiré et que la date proposée n'est pas passée.
 */
export function etatProposition(
  p: { statut: string; expire_le: string; date_proposee: string } | null,
  nowIso: string,
  today: string,
): EtatProposition {
  if (!p) return "introuvable";
  if (p.statut === "annulee") return "annulee";
  if (p.statut !== "envoyee") return "repondue";
  if (p.expire_le <= nowIso) return "expiree";
  if (p.date_proposee < today) return "expiree";
  return "utilisable";
}

/** Réponse du client : le créneau proposé, l'index d'un autre créneau, ou aucun. */
export const reponseVisiteSchema = z.object({
  choix: z.union([z.literal("propose"), z.literal("aucun"), z.number().int().min(0).max(50)]),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type ReponseVisite = z.infer<typeof reponseVisiteSchema>;
