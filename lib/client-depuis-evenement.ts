/**
 * Client détecté dans un rendez-vous de l'agenda — logique PURE, testée
 * dans client-depuis-evenement.test.ts.
 *
 * Quand le client n'est pas encore fiché, ses coordonnées sont souvent
 * tapées dans le rendez-vous lui-même : libellé d'un RDV iPhone
 * (« Dupont 06 64 19 18 15 »), lieu iCal (« 12 rue des Alpes, 38000
 * Grenoble »), description d'une intervention, e-mail dans les notes.
 * On en tire un client prêt à enregistrer en un clic : nom, téléphone,
 * e-mail et adresse découpée (voie / code postal / ville).
 *
 * Rien n'est inventé : un champ non trouvé reste null. Sans nom, ou
 * sans la moindre coordonnée, on ne propose rien (« Pose clim » n'est
 * pas un client).
 */

import { extraireAdresse, extraireTelephone } from "@/lib/agenda-contact";

export type ClientDetecte = {
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse_ligne1: string | null;
  code_postal: string | null;
  ville: string | null;
};

export type EvenementAvecCoordonnees = {
  /** Libellé (RDV iPhone) ou description affichée (intervention). */
  title?: string | null;
  description?: string | null;
  /** LOCATION iCal d'un RDV iPhone. */
  lieu?: string | null;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Première adresse e-mail trouvée dans le texte. */
export function extraireEmail(texte: string | null | undefined): string | null {
  if (!texte) return null;
  const m = EMAIL_RE.exec(texte);
  return m ? m[0] : null;
}

function nettoyer(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:—–·|-]+/, "")
    .replace(/[\s,;:—–·|-]+$/, "")
    .trim();
}

/**
 * « 12 rue des Alpes, 38000 Grenoble » (ou sur plusieurs lignes, comme
 * le lieu d'un RDV iPhone) → voie / code postal / ville. Sans code
 * postal, la ville est ce qui suit la dernière virgule si ce n'est pas
 * un numéro ; sinon tout va en première ligne d'adresse.
 */
export function decomposerAdresse(adresse: string): Pick<ClientDetecte, "adresse_ligne1" | "code_postal" | "ville"> {
  const a = nettoyer(adresse.replace(/[\r\n]+/g, ", ").replace(/,?\s*France\s*$/i, ""));
  if (!a) return { adresse_ligne1: null, code_postal: null, ville: null };
  const m = /^(.*?)[\s,]*\b(\d{5})\b[\s,]*(.*)$/.exec(a);
  if (m && m[2]) {
    return {
      adresse_ligne1: nettoyer(m[1] ?? "") || null,
      code_postal: m[2],
      ville: nettoyer(m[3] ?? "") || null,
    };
  }
  const virgule = a.lastIndexOf(",");
  if (virgule > 0) {
    const ville = nettoyer(a.slice(virgule + 1));
    if (ville && !/\d/.test(ville)) {
      return { adresse_ligne1: nettoyer(a.slice(0, virgule)) || null, code_postal: null, ville };
    }
  }
  return { adresse_ligne1: a, code_postal: null, ville: null };
}

// « M. Dupont », « Mme Martin », « Monsieur Jean Dupont » : le nom le
// plus sûr quand une civilité est écrite.
const CIVILITE_RE =
  /\b(M\.|Mr\.?|Mme\.?|Mlle\.?|Monsieur|Madame|Mademoiselle)\s+([\p{L}'’-]{2,}(?:\s+[\p{L}'’-]{2,}){0,2})/u;

// Mots de métier en tête de libellé (« RDV Dupont », « Dépannage chez
// Martin ») : retirés, ils ne font pas partie du nom.
const MOTS_METIER = new Set([
  "rdv", "rendez-vous", "devis", "visite", "chantier", "intervention", "dépannage", "depannage",
  "entretien", "pose", "installation", "réparation", "reparation", "contrôle", "controle",
  "chez", "client", "sav", "urgence", "urgent", "mise", "en", "service", "remplacement",
]);

/**
 * Nom du client dans le texte, une fois retirés téléphone, e-mail et
 * adresse : la civilité si elle est écrite, sinon le premier segment
 * (avant « — », « · », virgule, retour à la ligne…) débarrassé des mots
 * de métier en tête. Plus de quatre mots : c'est un descriptif de
 * travaux, pas un nom.
 */
export function nomDepuisTexte(texte: string, retirer: Array<string | null | undefined>): string | null {
  let t = texte;
  for (const r of retirer) if (r) t = t.split(r).join(" ");
  const civ = CIVILITE_RE.exec(t);
  if (civ) return nettoyer(`${civ[1]} ${civ[2]}`);
  const segments = t
    .split(/[\r\n—–·|,;:()[\]]+|\s-\s|\s\/\s/)
    .map(nettoyer)
    .filter(Boolean);
  for (const segment of segments) {
    const mots = segment.split(" ");
    while (mots.length > 0 && MOTS_METIER.has(mots[0]!.toLowerCase().replace(/[^\p{L}-]/gu, ""))) mots.shift();
    const nom = nettoyer(mots.join(" "));
    if (!nom || !/\p{L}{2}/u.test(nom)) continue;
    return mots.length > 4 ? null : nom;
  }
  return null;
}

/**
 * Le client que le rendez-vous décrit, ou null s'il n'y a pas de quoi
 * créer une fiche (pas de nom, ou aucune coordonnée).
 */
export function clientDepuisEvenement(e: EvenementAvecCoordonnees): ClientDetecte | null {
  const textes: string[] = [];
  for (const t of [e.title, e.description]) {
    const propre = (t ?? "").trim();
    if (propre && !textes.includes(propre)) textes.push(propre);
  }
  const lieu = (e.lieu ?? "").trim();
  const texte = [...textes, lieu].filter(Boolean).join("\n");

  const email = extraireEmail(texte);
  const sansEmail = email ? texte.split(email).join(" ") : texte;
  const telephone = extraireTelephone(sansEmail);
  const adresseTexte = lieu ? null : extraireAdresse(sansEmail);
  const adresseBrute = lieu || adresseTexte;
  const adresse = adresseBrute
    ? decomposerAdresse(adresseBrute)
    : { adresse_ligne1: null, code_postal: null, ville: null };

  const nom = nomDepuisTexte(textes.join("\n"), [email, telephone, adresseTexte]);
  if (!nom) return null;
  if (!telephone && !email && !adresse.adresse_ligne1 && !adresse.ville) return null;

  return { nom, telephone, email, ...adresse };
}

/** Résumé d'une ligne pour l'affichage (« 06 64 19 18 15 · dupont@… · 12 rue… »). */
export function adresseDetectee(c: ClientDetecte): string | null {
  const parts = [c.adresse_ligne1, [c.code_postal, c.ville].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}
