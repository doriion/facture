/**
 * Saisie d'une tournée — logique PURE, testée dans tournee.test.ts.
 *
 * Le planning arrive en texte (SMS ou mail du donneur d'ordre, tableau
 * collé, photo passée à l'OCR) : des dates en titre, puis des lignes
 * « NOM Prénom, adresse, téléphone, heure » ou un rendez-vous sur deux
 * lignes (nom, puis adresse). On en tire une liste de rendez-vous à
 * vérifier, puis à créer d'un coup (clients compris).
 *
 * Rien n'est inventé : sans date trouvée, c'est la date par défaut ;
 * sans heure, un rendez-vous « à la journée ».
 */

import { extraireAdresse, extraireTelephone } from "@/lib/agenda-contact";
import { decomposerAdresse } from "@/lib/client-depuis-evenement";
import { ajouterJours } from "@/lib/agenda-vues";

export type RdvTournee = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM ou null (journée) */
  heure: string | null;
  nom: string;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  /** Texte d'origine (devient le descriptif du rendez-vous). */
  texte: string;
};

const MOIS: Record<string, number> = {
  janvier: 1, janv: 1, fevrier: 2, février: 2, fev: 2, fév: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7, aout: 8, août: 8, septembre: 9, sept: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, decembre: 12, décembre: 12, dec: 12, déc: 12,
};
const JOURS_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Date écrite dans une ligne : « 12/11 », « 12/11/2026 », « 12-11-26 »,
 * « mardi 12 novembre », « 12 nov. », « lundi 12 ». Sans année : celle
 * qui rend la date la plus proche après la date de référence (une
 * tournée se saisit pour les semaines à venir).
 */
export function dateDansTexte(ligne: string, reference: string): string | null {
  const t = ligne.toLowerCase();
  const annee0 = Number(reference.slice(0, 4));
  const complete = (j: number, m: number, a: number | null): string | null => {
    if (m < 1 || m > 12 || j < 1 || j > 31) return null;
    if (a !== null) {
      const an = a < 100 ? 2000 + a : a;
      return `${an}-${pad(m)}-${pad(j)}`;
    }
    const candidate = `${annee0}-${pad(m)}-${pad(j)}`;
    // Plus de 6 mois dans le passé : c'est l'année prochaine.
    return candidate < ajouterJours(reference, -180) ? `${annee0 + 1}-${pad(m)}-${pad(j)}` : candidate;
  };
  let m = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/.exec(t);
  if (m) return complete(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : null);
  m = /\b(\d{1,2})(?:er)?\s+([a-zéû]{3,9})\.?(?:\s+(\d{4}))?\b/.exec(t);
  if (m && MOIS[m[2]!]) return complete(Number(m[1]), MOIS[m[2]!]!, m[3] ? Number(m[3]) : null);
  // « lundi 12 » : le prochain jour de ce nom dont le numéro correspond.
  m = /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\b/.exec(t);
  if (m) {
    const jour = Number(m[2]);
    for (let i = 0; i < 400; i++) {
      const d = ajouterJours(reference, i);
      const dt = new Date(`${d}T00:00:00Z`);
      if (dt.getUTCDate() === jour && JOURS_SEMAINE[dt.getUTCDay()] === m[1]) return d;
    }
  }
  return null;
}

/** Première heure écrite : « 9h », « 9h30 », « 09:30 », « 14 h 00 ». */
export function heureDansTexte(ligne: string): string | null {
  const m = /\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?\b/i.exec(ligne);
  if (!m) return null;
  // « 12/11 » n'est pas une heure : le motif exige « h » ou « : ».
  return `${pad(Number(m[1]))}:${m[2] ?? "00"}`;
}

/** Une ligne qui n'est qu'une date (titre de journée), éventuellement précédée du jour. */
function estTitreDate(ligne: string, reference: string): string | null {
  const t = ligne.trim().replace(/[:\-–—]+$/, "").trim();
  if (!t || t.length > 40) return null;
  if (/\d{5}/.test(t)) return null; // un code postal : une adresse, pas un titre
  const d = dateDansTexte(t, reference);
  if (!d) return null;
  const sansDate = t
    .toLowerCase()
    .replace(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/g, "")
    .replace(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g, "")
    .replace(/\b\d{1,2}(?:er)?\s+[a-zéû]{3,9}\.?(?:\s+\d{4})?\b/g, "")
    .replace(/\b\d{1,2}\b/g, "")
    .replace(/[^\p{L}]/gu, "");
  return sansDate.length <= 2 ? d : null;
}

function nettoyer(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^[\s,;:—–·|-]+/, "").replace(/[\s,;:—–·|-]+$/, "").trim();
}

/** Ressemble à un nom de personne ou de société (court, sans numéro de voie). */
function ressembleANom(segment: string): boolean {
  const s = nettoyer(segment);
  if (!s || s.length > 60) return false;
  if (/^\d/.test(s)) return false;
  if (extraireAdresse(s)) return false;
  if (extraireTelephone(s)) return false;
  const mots = s.split(" ");
  return mots.length <= 5 && /\p{L}{2}/u.test(s);
}

/**
 * « 41 Rue Casimir Périer VIZILLE » (ni virgule ni code postal) : la
 * ville est le mot (ou les mots) tout en majuscules à la fin, quand la
 * voie, elle, est en minuscules. Une adresse entièrement en capitales
 * reste entière : on ne devine pas.
 */
export function separerVilleMajuscules(a: { adresse_ligne1: string | null; code_postal: string | null; ville: string | null }): typeof a {
  if (a.code_postal || a.ville || !a.adresse_ligne1) return a;
  const m = /^(.*\p{Ll}.*?)\s+((?:[A-ZÀ-Ý][A-ZÀ-Ý'-]+)(?:\s+[A-ZÀ-Ý][A-ZÀ-Ý'-]*)*)$/u.exec(a.adresse_ligne1.trim());
  if (!m) return a;
  return { adresse_ligne1: m[1]!.trim(), code_postal: null, ville: m[2]!.trim() };
}

type Brouillon = { date: string; heure: string | null; lignes: string[] };

/**
 * Texte collé → rendez-vous. Les lignes vides séparent les entrées ; une
 * ligne qui ressemble à un nom en commence une nouvelle ; les lignes
 * suivantes (adresse, téléphone, heure) complètent l'entrée en cours.
 */
export function parserTournee(texte: string, options: { dateParDefaut: string }): RdvTournee[] {
  const ref = options.dateParDefaut;
  let dateCourante = ref;
  const brouillons: Brouillon[] = [];
  let courant: Brouillon | null = null;
  const fermer = () => {
    if (courant && courant.lignes.length > 0) brouillons.push(courant);
    courant = null;
  };

  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.replace(/\t/g, " ").trim();
    if (!ligne) {
      fermer();
      continue;
    }
    const titre = estTitreDate(ligne, ref);
    if (titre) {
      fermer();
      dateCourante = titre;
      continue;
    }
    // Entrée sur UNE ligne (virgules ou point-virgules) : nom puis le reste.
    const segments = ligne.split(/\s*[;,]\s*|\s+[—–|]\s+/).map(nettoyer).filter(Boolean);
    const premier = segments[0] ?? "";
    const commenceEntree = ressembleANom(premier) && (courant === null || courant.lignes.length > 0);
    if (commenceEntree && (courant === null || !ressembleANom(courant.lignes[courant.lignes.length - 1] ?? "") || courant.lignes.length > 1)) {
      fermer();
      courant = { date: dateCourante, heure: null, lignes: [] };
    }
    if (!courant) courant = { date: dateCourante, heure: null, lignes: [] };
    const heure = heureDansTexte(ligne);
    if (heure && !courant.heure) courant.heure = heure;
    const dateLigne = dateDansTexte(ligne, ref);
    if (dateLigne && !estTitreDate(ligne, ref) && !/\d{5}/.test(ligne)) courant.date = dateLigne;
    courant.lignes.push(ligne);
  }
  fermer();

  return brouillons
    .map((b) => {
      const bloc = b.lignes.join("\n");
      const telephone = extraireTelephone(bloc);
      let reste = telephone ? bloc.split(telephone).join(" ") : bloc;
      reste = reste
        .replace(/\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?\b/gi, " ")
        .replace(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g, " ");
      const adresseBrute = extraireAdresse(reste);
      // Nom : premier segment qui ressemble à un nom, débarrassé de l'adresse.
      const sansAdresse = adresseBrute ? reste.split(adresseBrute).join("\n") : reste;
      const candidats = sansAdresse
        .split(/\r?\n|\s*[;,]\s*|\s+[—–|]\s+|\s*\(.*?\)\s*/)
        .map(nettoyer)
        .filter(Boolean);
      const nom = candidats.find((c) => ressembleANom(c)) ?? null;
      if (!nom) return null;
      const adresse = adresseBrute ? separerVilleMajuscules(decomposerAdresse(adresseBrute)) : { adresse_ligne1: null, code_postal: null, ville: null };
      return {
        date: b.date,
        heure: b.heure,
        nom,
        adresse: adresse.adresse_ligne1,
        code_postal: adresse.code_postal,
        ville: adresse.ville,
        telephone,
        texte: bloc,
      } satisfies RdvTournee;
    })
    .filter((r): r is RdvTournee => r !== null);
}
