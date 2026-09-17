/**
 * Déplacement d'un rendez-vous par glisser-déposer — logique PURE,
 * testée dans agenda-deplacement.test.ts.
 *
 * Sur la grille (vues jour / semaine), on dépose un créneau sur un jour
 * et une heure : la durée est conservée, l'heure est arrondie au quart
 * d'heure. En vue mois, seul le jour change (les heures restent). Une
 * intervention sur plusieurs jours garde sa durée en jours.
 *
 * Seules les interventions non facturées se déplacent : une fois la
 * facture émise, le planning se corrige depuis la fiche, pas d'un geste.
 */

import type { AgendaEvent } from "@/lib/actions/agenda";
import { ajouterJours, depuisYmd, libelleJour } from "@/lib/agenda-vues";

/** Pas d'arrondi de l'heure déposée (minutes). */
export const PAS_MINUTES = 15;
const DERNIERE_MINUTE = 23 * 60 + 59;

export type ValeursDeplacement = {
  date_intervention: string;
  date_fin: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
};

/** Cible du dépôt : un jour, et sur la grille l'heure de début (minutes). */
export type CibleDeplacement = { jour: string; debut?: number };

/** Intervention non facturée : on peut la glisser. */
export function estDeplacable(e: Pick<AgendaEvent, "kind" | "facture_emise">): boolean {
  return e.kind === "intervention" && !e.facture_emise;
}

/** « 14:30 » ou « 14:30:00 » → minutes depuis minuit. */
export function minutesDeHeure(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Minutes depuis minuit → « HH:MM:00 » (format base), borné à 23:59. */
export function heureDeMinutes(min: number): string {
  const total = Math.max(0, Math.min(Math.round(min), DERNIERE_MINUTE));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** Arrondi au pas (15 min par défaut). */
export function arrondirAuPas(min: number, pas: number = PAS_MINUTES): number {
  return Math.round(min / pas) * pas;
}

function joursEntre(depuis: string, jusqua: string): number {
  return Math.round((depuisYmd(jusqua).getTime() - depuisYmd(depuis).getTime()) / 86_400_000);
}

function heureBase(t: string | null): string | null {
  return t ? heureDeMinutes(minutesDeHeure(t)) : null;
}

/** Valeurs de planning actuelles d'un évènement (pour « Annuler »). */
export function valeursActuelles(
  e: Pick<AgendaEvent, "date_start" | "date_end" | "heure_debut" | "heure_fin">,
): ValeursDeplacement {
  return {
    date_intervention: e.date_start,
    date_fin: e.date_end !== e.date_start ? e.date_end : null,
    heure_debut: heureBase(e.heure_debut),
    heure_fin: heureBase(e.heure_fin),
  };
}

/**
 * Nouveau planning après dépôt. Les jours se décalent d'un bloc (une
 * intervention du 16 au 18 déposée le 20 va du 20 au 22). Sans heure de
 * dépôt, ou pour un évènement « journée entière », les heures ne
 * bougent pas. Avec une heure : début arrondi au quart d'heure, fin =
 * début + durée d'origine, le tout borné pour finir avant minuit.
 */
export function deplacer(
  e: Pick<AgendaEvent, "date_start" | "date_end" | "heure_debut" | "heure_fin">,
  cible: CibleDeplacement,
): ValeursDeplacement {
  const decalage = joursEntre(e.date_start, cible.jour);
  const actuel = valeursActuelles(e);
  const valeurs: ValeursDeplacement = {
    date_intervention: cible.jour,
    date_fin: actuel.date_fin ? ajouterJours(actuel.date_fin, decalage) : null,
    heure_debut: actuel.heure_debut,
    heure_fin: actuel.heure_fin,
  };
  if (cible.debut === undefined || !e.heure_debut) return valeurs;

  const debutOrigine = minutesDeHeure(e.heure_debut);
  const duree = e.heure_fin ? Math.max(minutesDeHeure(e.heure_fin) - debutOrigine, 0) : null;
  const debut = Math.max(0, Math.min(arrondirAuPas(cible.debut), DERNIERE_MINUTE - (duree ?? 0)));
  valeurs.heure_debut = heureDeMinutes(debut);
  valeurs.heure_fin = duree === null ? null : heureDeMinutes(debut + duree);
  return valeurs;
}

/** Vrai si le dépôt change quelque chose (sinon on ne touche pas la base). */
export function aChange(
  e: Pick<AgendaEvent, "date_start" | "date_end" | "heure_debut" | "heure_fin">,
  v: ValeursDeplacement,
): boolean {
  const a = valeursActuelles(e);
  return (
    a.date_intervention !== v.date_intervention ||
    a.date_fin !== v.date_fin ||
    a.heure_debut !== v.heure_debut ||
    a.heure_fin !== v.heure_fin
  );
}

/** « Jeudi 18 sept. · 14:15–16:15 » (message de confirmation). */
export function libelleDeplacement(v: ValeursDeplacement, aujourdhui?: string): string {
  let s = libelleJour(v.date_intervention, aujourdhui);
  if (v.date_fin) s += ` → ${libelleJour(v.date_fin, aujourdhui)}`;
  if (v.heure_debut) {
    s += ` · ${v.heure_debut.slice(0, 5)}`;
    if (v.heure_fin) s += `–${v.heure_fin.slice(0, 5)}`;
  }
  return s;
}

/** Durée minimale d'un créneau étiré (minutes). */
export const DUREE_MIN_ETIREMENT = 15;

/**
 * Étirer un créneau par le bas : nouvelle heure de fin, arrondie au
 * quart d'heure, jamais moins de 15 min après le début ni après 23:59.
 * Les dates et l'heure de début ne bougent pas. Sans heure de début, on
 * ne change rien.
 */
export function redimensionner(
  e: Pick<AgendaEvent, "date_start" | "date_end" | "heure_debut" | "heure_fin">,
  finMinutes: number,
): ValeursDeplacement {
  const actuel = valeursActuelles(e);
  if (!e.heure_debut) return actuel;
  const debut = minutesDeHeure(e.heure_debut);
  const fin = Math.min(
    Math.max(arrondirAuPas(finMinutes), debut + DUREE_MIN_ETIREMENT),
    DERNIERE_MINUTE,
  );
  return { ...actuel, heure_fin: heureDeMinutes(fin) };
}
