/**
 * Rappels push avant un rendez-vous — logique PURE, testée dans
 * rappels-push.test.ts.
 *
 * Quand envoyer : `delai` minutes avant l'heure de début (heure de
 * Paris). Pour un rendez-vous « journée entière », la veille à 18 h.
 * Le déclencheur passe toutes les 5 min : un rappel est « dû » quand
 * son instant est passé depuis moins de `grace` minutes (au-delà, on
 * le considère manqué plutôt que de notifier en retard).
 */

export const RAPPEL_JOURNEE_ENTIERE_HEURE = 18;
/** Fenêtre après l'instant du rappel pendant laquelle on l'envoie encore. */
export const GRACE_MINUTES = 30;
export const DELAIS_RAPPEL = [10, 15, 30, 60, 120] as const;

export type InterventionARappeler = {
  id: string;
  date_intervention: string;
  heure_debut: string | null;
  heure_fin: string | null;
  description: string | null;
  type: string;
  client_nom?: string | null;
  client_adresse?: string | null;
  rappel_push_envoye_le?: string | null;
};

/** Décalage (ms) entre Europe/Paris et UTC à un instant donné. */
function decalageParis(instantUtc: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantUtc));
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const commeUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return commeUtc - instantUtc;
}

/** Instant (ms) d'une date + heure exprimées en heure de Paris (heure d'été comprise). */
export function instantParis(ymd: string, heures: number, minutes: number): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const estimation = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, heures, minutes);
  // Deux passes : le décalage peut changer autour du passage d'heure.
  const premiere = estimation - decalageParis(estimation);
  return estimation - decalageParis(premiere);
}

/** Instant (ms) auquel le rappel doit partir, null si l'heure manque et que ce n'est pas une journée entière. */
export function instantRappel(i: Pick<InterventionARappeler, "date_intervention" | "heure_debut">, delaiMinutes: number): number {
  if (i.heure_debut) {
    const [h, m] = i.heure_debut.split(":").map(Number);
    return instantParis(i.date_intervention, h ?? 0, m ?? 0) - delaiMinutes * 60_000;
  }
  // Journée entière : la veille à 18 h.
  const [y, mo, d] = i.date_intervention.split("-").map(Number);
  const veille = new Date(Date.UTC(y!, (mo ?? 1) - 1, (d ?? 1) - 1));
  return instantParis(veille.toISOString().slice(0, 10), RAPPEL_JOURNEE_ENTIERE_HEURE, 0);
}

/**
 * Rendez-vous dont le rappel est dû maintenant : instant passé, depuis
 * moins de `grace` minutes, et jamais envoyé.
 */
export function rappelsDus<T extends InterventionARappeler>(
  interventions: T[],
  maintenant: number,
  delaiMinutes: number,
  graceMinutes: number = GRACE_MINUTES,
): T[] {
  return interventions.filter((i) => {
    if (i.rappel_push_envoye_le) return false;
    const t = instantRappel(i, delaiMinutes);
    return t <= maintenant && maintenant - t < graceMinutes * 60_000;
  });
}

/** Plage de jours (Paris) à charger pour trouver les rappels dus : aujourd'hui et demain. */
export function joursACharger(maintenant: number): { depuis: string; jusquau: string } {
  const paris = new Date(maintenant + decalageParis(maintenant));
  const depuis = paris.toISOString().slice(0, 10);
  paris.setUTCDate(paris.getUTCDate() + 1);
  return { depuis, jusquau: paris.toISOString().slice(0, 10) };
}

export type ContenuPush = {
  titre: string;
  corps: string;
  url: string;
  /** Regroupe / remplace une notification du même rendez-vous. */
  tag: string;
};

function heureCourte(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

/** Titre / corps de la notification. */
export function contenuRappel(i: InterventionARappeler, delaiMinutes: number): ContenuPush {
  const libelle = i.description || i.type || "Intervention";
  const titre = i.client_nom ? `${libelle} · ${i.client_nom}` : libelle;
  const morceaux: string[] = [];
  if (i.heure_debut) {
    const quand =
      delaiMinutes < 60
        ? `Dans ${delaiMinutes} min`
        : delaiMinutes % 60 === 0
          ? `Dans ${delaiMinutes / 60} h`
          : `Dans ${Math.floor(delaiMinutes / 60)} h ${delaiMinutes % 60}`;
    morceaux.push(`${quand} · ${heureCourte(i.heure_debut)}${i.heure_fin ? `–${heureCourte(i.heure_fin)}` : ""}`);
  } else {
    morceaux.push("Demain, journée entière");
  }
  if (i.client_adresse) morceaux.push(i.client_adresse);
  return {
    titre,
    corps: morceaux.join("\n"),
    url: `/agenda?vue=jour&date=${i.date_intervention}`,
    tag: `rdv-${i.id}`,
  };
}
