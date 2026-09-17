/**
 * Vues de l'agenda (jour / semaine / mois / liste) — logique PURE,
 * testée dans agenda-vues.test.ts : choix de la vue par défaut, plages
 * de dates, regroupement par jour, position des créneaux horaires.
 * Aucune I/O : le composant ne fait que rendre ce qui est calculé ici.
 */

export const VUES_AGENDA = ["jour", "semaine", "mois", "liste"] as const;
export type VueAgenda = (typeof VUES_AGENDA)[number];

export const LABELS_VUE: Record<VueAgenda, string> = {
  jour: "Jour",
  semaine: "Semaine",
  mois: "Mois",
  liste: "Liste",
};

/** Clé localStorage du dernier choix de vue (par appareil, pas de migration). */
export const CLE_VUE_AGENDA = "facture-ae:agenda-vue";

export function normaliserVue(v: unknown): VueAgenda | null {
  return typeof v === "string" && (VUES_AGENDA as readonly string[]).includes(v)
    ? (v as VueAgenda)
    : null;
}

/**
 * Vue au premier affichage : celle de l'URL, sinon le dernier choix
 * mémorisé, sinon JOUR sur mobile (agenda principal : « qu'est-ce que
 * j'ai aujourd'hui », avec le bandeau des jours pour naviguer) et MOIS
 * sur desktop (comme avant).
 */
export function vueInitiale(args: {
  depuisUrl?: unknown;
  memorisee?: unknown;
  mobile: boolean;
}): VueAgenda {
  return (
    normaliserVue(args.depuisUrl) ??
    normaliserVue(args.memorisee) ??
    (args.mobile ? "jour" : "mois")
  );
}

// ---------------------------------------------------------------------------
// Dates (YYYY-MM-DD, calendrier local)
// ---------------------------------------------------------------------------

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function depuisYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function ajouterJours(s: string, n: number): string {
  const d = depuisYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Lundi de la semaine contenant la date. */
export function debutSemaine(s: string): string {
  const d = depuisYmd(s);
  const decalage = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - decalage);
  return ymd(d);
}

/** Les 7 jours (lundi → dimanche) de la semaine contenant la date. */
export function joursSemaine(s: string): string[] {
  const lundi = debutSemaine(s);
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
}

/** Date affichée après « précédent » / « suivant » selon la vue. */
export function naviguer(vue: VueAgenda, date: string, sens: 1 | -1): string {
  if (vue === "jour") return ajouterJours(date, sens);
  if (vue === "semaine") return ajouterJours(date, 7 * sens);
  // mois (la liste ne navigue pas : elle part d'aujourd'hui)
  const d = depuisYmd(date);
  d.setDate(1);
  d.setMonth(d.getMonth() + sens);
  return ymd(d);
}

/** Nombre de jours affichés par la vue liste à partir d'aujourd'hui. */
export const JOURS_LISTE = 60;

// ---------------------------------------------------------------------------
// Libellés
// ---------------------------------------------------------------------------

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Jeudi 18 sept. » — ou « Aujourd'hui » / « Demain » si `aujourdhui` est fourni. */
export function libelleJour(s: string, aujourdhui?: string): string {
  if (aujourdhui) {
    if (s === aujourdhui) return "Aujourd'hui";
    if (s === ajouterJours(aujourdhui, 1)) return "Demain";
  }
  const d = depuisYmd(s);
  return `${majuscule(JOURS[d.getDay()]!)} ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}

/** « Jeudi 18 septembre 2026 » */
export function libelleJourLong(s: string): string {
  const d = depuisYmd(s);
  return `${majuscule(JOURS[d.getDay()]!)} ${d.getDate()} ${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
}

/** « Lun 14 » — en-tête de colonne sur petit écran. */
export function libelleJourCourt(s: string): string {
  const d = depuisYmd(s);
  return `${majuscule(JOURS[d.getDay()]!.slice(0, 3))} ${d.getDate()}`;
}

/** « 14 – 20 sept. 2026 » (ou « 28 sept. – 4 oct. 2026 » à cheval). */
export function libelleSemaine(s: string): string {
  const jours = joursSemaine(s);
  const a = depuisYmd(jours[0]!);
  const b = depuisYmd(jours[6]!);
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${b.getDate()} ${MOIS_COURTS[a.getMonth()]} ${b.getFullYear()}`;
  }
  return `${a.getDate()} ${MOIS_COURTS[a.getMonth()]} – ${b.getDate()} ${MOIS_COURTS[b.getMonth()]} ${b.getFullYear()}`;
}

/** « Septembre 2026 » */
export function libelleMois(s: string): string {
  const d = depuisYmd(s);
  return `${majuscule(MOIS_LONGS[d.getMonth()]!)} ${d.getFullYear()}`;
}

/** « 09:00 » depuis « 09:00:00 » */
export function heureCourte(t: string | null | undefined): string | null {
  return t ? t.slice(0, 5) : null;
}

// ---------------------------------------------------------------------------
// Regroupement (vue liste) et créneaux (vues jour / semaine)
// ---------------------------------------------------------------------------

export type EvenementMinimal = {
  date_start: string;
  date_end: string;
  heure_debut: string | null;
  heure_fin: string | null;
};

function minutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Ordre chronologique : journée entière d'abord, puis par heure de début. */
export function comparerHoraire(a: EvenementMinimal, b: EvenementMinimal): number {
  if (!a.heure_debut && b.heure_debut) return -1;
  if (a.heure_debut && !b.heure_debut) return 1;
  if (a.heure_debut && b.heure_debut) return minutes(a.heure_debut) - minutes(b.heure_debut);
  return 0;
}

/**
 * Vue liste : les évènements couvrant chaque jour de [depuis, depuis +
 * nbJours), groupés par jour, les plus proches en premier. Un évènement
 * multi-jours apparaît sous chacun de ses jours. Les jours vides sont
 * omis.
 */
export function grouperParJour<T extends EvenementMinimal>(
  evenements: T[],
  depuis: string,
  nbJours: number = JOURS_LISTE,
): Array<{ jour: string; evenements: T[] }> {
  const groupes: Array<{ jour: string; evenements: T[] }> = [];
  for (let i = 0; i < nbJours; i++) {
    const jour = ajouterJours(depuis, i);
    const duJour = evenements
      .filter((e) => e.date_start <= jour && e.date_end >= jour)
      .sort(comparerHoraire);
    if (duJour.length > 0) groupes.push({ jour, evenements: duJour });
  }
  return groupes;
}

export const HEURE_DEBUT_GRILLE = 7;
export const HEURE_FIN_GRILLE = 20;
/** Durée retenue quand l'heure de fin manque. */
export const DUREE_DEFAUT_MIN = 60;

export type Creneau = {
  /** Position et hauteur en % de la grille [HEURE_DEBUT, HEURE_FIN]. */
  top: number;
  height: number;
  /** Bornes en minutes depuis minuit (rognées à la grille) — pour une grille aux lignes inégales. */
  debut: number;
  fin: number;
  /** Colonne (0..n-1) et nombre de colonnes quand des créneaux se chevauchent. */
  colonne: number;
  colonnes: number;
};

/**
 * Créneaux positionnés sur la grille horaire du jour. Les évènements
 * sans heure ne sont pas ici (ils vont dans le bandeau « journée »).
 * Une heure de fin absente vaut début + 1 h ; ce qui déborde de la
 * grille est rogné. Les chevauchements sont répartis en colonnes.
 */
export function creneauxDuJour<T extends EvenementMinimal>(
  evenements: T[],
  bornes: { debut: number; fin: number } = { debut: HEURE_DEBUT_GRILLE, fin: HEURE_FIN_GRILLE },
): Array<{ evenement: T; creneau: Creneau }> {
  const minGrille = bornes.debut * 60;
  const maxGrille = bornes.fin * 60;
  const total = maxGrille - minGrille;

  const horodates = evenements
    .filter((e) => e.heure_debut)
    .map((e) => {
      const debut = minutes(e.heure_debut!);
      const finBrute = e.heure_fin ? minutes(e.heure_fin) : debut + DUREE_DEFAUT_MIN;
      const fin = Math.max(finBrute, debut + 15); // au moins 15 min visibles
      return { e, debut, fin };
    })
    .filter(({ debut, fin }) => fin > minGrille && debut < maxGrille)
    .sort((a, b) => a.debut - b.debut || a.fin - b.fin);

  // Colonnes : parcours chronologique, on prend la première colonne
  // libre ; un groupe d'évènements qui se chevauchent partage la même
  // largeur (nombre max de colonnes du groupe).
  type Place = { e: T; debut: number; fin: number; colonne: number; groupe: number };
  const places: Place[] = [];
  let finsColonnes: number[] = [];
  let groupe = 0;
  let finGroupe = -1;
  for (const h of horodates) {
    if (h.debut >= finGroupe) {
      groupe += 1;
      finsColonnes = [];
    }
    let colonne = finsColonnes.findIndex((fin) => fin <= h.debut);
    if (colonne === -1) {
      colonne = finsColonnes.length;
      finsColonnes.push(h.fin);
    } else {
      finsColonnes[colonne] = h.fin;
    }
    finGroupe = Math.max(finGroupe, h.fin);
    places.push({ ...h, colonne, groupe });
  }
  const colonnesParGroupe = new Map<number, number>();
  for (const p of places) {
    colonnesParGroupe.set(p.groupe, Math.max(colonnesParGroupe.get(p.groupe) ?? 0, p.colonne + 1));
  }

  return places.map((p) => {
    const debut = Math.max(p.debut, minGrille);
    const fin = Math.min(p.fin, maxGrille);
    return {
      evenement: p.e,
      creneau: {
        top: ((debut - minGrille) / total) * 100,
        height: ((fin - debut) / total) * 100,
        debut,
        fin,
        colonne: p.colonne,
        colonnes: colonnesParGroupe.get(p.groupe) ?? 1,
      },
    };
  });
}

/** « 14:00 » depuis un nombre d'heures (14 → « 14:00 », 8.5 → « 08:30 »), borné à 23:59. */
export function formatHeure(heures: number): string {
  const total = Math.max(0, Math.min(Math.round(heures * 60), 23 * 60 + 59));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Créneau pré-rempli quand on clique (ou glisse) sur la grille horaire :
 * l'heure cliquée devient l'heure de début, la fin = début + 1 h par
 * défaut — ou la fin de la dernière ligne sélectionnée en cas de
 * clic-glisser (`fin` = heure exclusive, ex. 14 → 16 donne 14:00–16:00).
 * Une plage à l'envers est remise dans l'ordre.
 */
export function creneauDepuisHeures(
  debut: number,
  fin?: number,
): { heure_debut: string; heure_fin: string } {
  const a = fin === undefined ? debut : Math.min(debut, fin);
  const b = fin === undefined ? debut + DUREE_DEFAUT_MIN / 60 : Math.max(debut, fin);
  const finEffective = b <= a ? a + DUREE_DEFAUT_MIN / 60 : b;
  return { heure_debut: formatHeure(a), heure_fin: formatHeure(finEffective) };
}

/** Jours (parmi ceux donnés) qui ont au moins un évènement — points du bandeau des jours. */
export function joursAvecEvenements<T extends EvenementMinimal>(
  evenements: T[],
  jours: string[],
): Set<string> {
  const charges = new Set<string>();
  for (const jour of jours) {
    if (evenements.some((e) => e.date_start <= jour && e.date_end >= jour)) charges.add(jour);
  }
  return charges;
}

/** Évènements sans heure (journée entière) couvrant le jour. */
export function journeeEntiere<T extends EvenementMinimal>(evenements: T[], jour: string): T[] {
  return evenements.filter((e) => !e.heure_debut && e.date_start <= jour && e.date_end >= jour);
}

/** Évènements horodatés du jour (les multi-jours horodatés comptent sur chaque jour). */
export function horodatesDuJour<T extends EvenementMinimal>(evenements: T[], jour: string): T[] {
  return evenements.filter((e) => e.heure_debut && e.date_start <= jour && e.date_end >= jour);
}

// ---------------------------------------------------------------------------
// Disposition de la grille horaire : bornes élargies aux évènements et
// heures vides compactées (vue jour). Les lignes n'ont plus toutes la même
// hauteur : on convertit minutes ↔ pixels avec les fonctions ci-dessous.
// ---------------------------------------------------------------------------

/**
 * Bornes de la grille pour les jours affichés : 7h → 20h, élargies si un
 * évènement commence avant ou finit après (une pose à 6h30 doit se voir).
 */
export function bornesGrille<T extends EvenementMinimal>(
  evenements: T[],
  jours: string[],
): { debut: number; fin: number } {
  let debut = HEURE_DEBUT_GRILLE;
  let fin = HEURE_FIN_GRILLE;
  for (const jour of jours) {
    for (const e of horodatesDuJour(evenements, jour)) {
      const d = minutes(e.heure_debut!);
      const f = e.heure_fin ? minutes(e.heure_fin) : d + DUREE_DEFAUT_MIN;
      debut = Math.min(debut, Math.floor(d / 60));
      fin = Math.max(fin, Math.ceil(f / 60));
    }
  }
  return { debut: Math.max(0, debut), fin: Math.min(24, fin) };
}

/** Heures (entières) couvertes par au moins un évènement sur les jours affichés. */
export function heuresOccupees<T extends EvenementMinimal>(
  evenements: T[],
  jours: string[],
): Set<number> {
  const occupees = new Set<number>();
  for (const jour of jours) {
    for (const e of horodatesDuJour(evenements, jour)) {
      const d = minutes(e.heure_debut!);
      const f = Math.max(e.heure_fin ? minutes(e.heure_fin) : d + DUREE_DEFAUT_MIN, d + 1);
      for (let h = Math.floor(d / 60); h < Math.ceil(f / 60); h++) occupees.add(h);
    }
  }
  return occupees;
}

export type LigneHoraire = {
  heure: number;
  /** Position et hauteur en px. */
  top: number;
  height: number;
  compacte: boolean;
};

/**
 * Lignes de la grille avec leur position : les heures vides sont
 * réduites (`hauteurCompacte`) quand `compacter` est vrai, sauf l'heure
 * en cours (`heureActuelle`) qui reste lisible. Sans compaction, toutes
 * les lignes font `hauteurPleine`.
 */
export function dispositionGrille(args: {
  debut: number;
  fin: number;
  occupees: Set<number>;
  hauteurPleine: number;
  hauteurCompacte: number;
  compacter: boolean;
  heureActuelle?: number | null;
}): LigneHoraire[] {
  const lignes: LigneHoraire[] = [];
  let top = 0;
  for (let h = args.debut; h < args.fin; h++) {
    const compacte =
      args.compacter && !args.occupees.has(h) && h !== (args.heureActuelle ?? -1);
    const height = compacte ? args.hauteurCompacte : args.hauteurPleine;
    lignes.push({ heure: h, top, height, compacte });
    top += height;
  }
  return lignes;
}

/** Hauteur totale de la grille (px). */
export function hauteurGrille(lignes: LigneHoraire[]): number {
  const derniere = lignes[lignes.length - 1];
  return derniere ? derniere.top + derniere.height : 0;
}

/** Position (px) d'un instant en minutes depuis minuit, rognée à la grille. */
export function yDeMinutes(lignes: LigneHoraire[], minutesDepuisMinuit: number): number {
  const premiere = lignes[0];
  if (!premiere) return 0;
  if (minutesDepuisMinuit <= premiere.heure * 60) return 0;
  for (const l of lignes) {
    if (minutesDepuisMinuit < (l.heure + 1) * 60) {
      return l.top + ((minutesDepuisMinuit - l.heure * 60) / 60) * l.height;
    }
  }
  return hauteurGrille(lignes);
}

/**
 * Minutes depuis minuit d'une position en px (inverse de yDeMinutes),
 * continues et bornées à la grille — pour poser un rendez-vous glissé
 * au quart d'heure près, même sur les heures compactées.
 */
export function minutesDeY(lignes: LigneHoraire[], y: number): number {
  const premiere = lignes[0];
  if (!premiere) return HEURE_DEBUT_GRILLE * 60;
  if (y <= 0) return premiere.heure * 60;
  for (const l of lignes) {
    if (y < l.top + l.height) {
      return l.heure * 60 + ((y - l.top) / l.height) * 60;
    }
  }
  return (lignes[lignes.length - 1]!.heure + 1) * 60;
}

/** Heure (entière) de la ligne qui contient une position en px, bornée à la grille. */
export function heureDeY(lignes: LigneHoraire[], y: number): number {
  const premiere = lignes[0];
  if (!premiere) return HEURE_DEBUT_GRILLE;
  for (const l of lignes) {
    if (y < l.top + l.height) return l.heure;
  }
  return lignes[lignes.length - 1]!.heure;
}

// ---------------------------------------------------------------------------
// Fenêtre de chargement : le serveur charge une plage de jours, le client
// navigue dedans sans recharger (swipe instantané) et ne repasse par le
// serveur qu'en sortant de la plage.
// ---------------------------------------------------------------------------

export type Fenetre = { debut: string; fin: string };

export function moisDe(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

export function premierDuMois(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function dernierDuMois(year: number, month: number): string {
  const suivant = month === 12 ? premierDuMois(year + 1, 1) : premierDuMois(year, month + 1);
  return ajouterJours(suivant, -1);
}

/**
 * Fenêtre chargée pour un mois : 7 jours avant le 1er → 7 jours après le
 * dernier (les cases débordantes de la grille), étendue à `depuis` /
 * `jusquau` si on les fournit (mois voisins, liste des 60 prochains jours).
 */
export function fenetreAgenda(
  year: number,
  month: number,
  options: { depuis?: string; jusquau?: string } = {},
): Fenetre {
  let debut = ajouterJours(premierDuMois(year, month), -7);
  let fin = ajouterJours(dernierDuMois(year, month), 7);
  if (options.depuis && options.depuis < debut) debut = options.depuis;
  if (options.jusquau && options.jusquau > fin) fin = options.jusquau;
  return { debut, fin };
}

/** La vue peut-elle afficher cette date sans recharger ? (tout ce qu'elle montre est dans la fenêtre) */
export function dansFenetre(vue: VueAgenda, date: string, fenetre: Fenetre): boolean {
  if (vue === "jour") return date >= fenetre.debut && date <= fenetre.fin;
  if (vue === "semaine") {
    const jours = joursSemaine(date);
    return jours[0]! >= fenetre.debut && jours[6]! <= fenetre.fin;
  }
  if (vue === "mois") {
    const { year, month } = moisDe(date);
    return premierDuMois(year, month) >= fenetre.debut && dernierDuMois(year, month) <= fenetre.fin;
  }
  return true; // liste : part d'aujourd'hui, la page garantit la couverture
}
