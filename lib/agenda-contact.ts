/**
 * Actions terrain d'un évènement — logique PURE, testée dans
 * agenda-contact.test.ts : où sont l'adresse et le téléphone, et quels
 * liens ouvrir (navigation, appel).
 *
 * Priorité au client rattaché (ses champs sont fiables). Sinon on
 * extrait du texte du RDV (libellé, description, lieu iCal) : un
 * numéro français se reconnaît sans ambiguïté ; une adresse, moins —
 * quand l'extraction est incertaine on propose une recherche sur le
 * libellé plutôt que rien.
 */

export type EvenementContactable = {
  title: string;
  description?: string | null;
  /** LOCATION iCal du RDV iPhone. */
  lieu?: string | null;
  client_adresse?: string | null;
  client_telephone?: string | null;
};

export type ContactEvenement = {
  /** Adresse à ouvrir dans Plans / Google Maps / Waze, null si aucune. */
  adresse: string | null;
  /** D'où vient l'adresse. */
  adresseSource: "client" | "lieu" | "texte" | null;
  /** Numéro affiché (tel qu'écrit), null si aucun. */
  telephone: string | null;
  telephoneSource: "client" | "texte" | null;
  /**
   * Sans adresse sûre : texte à chercher dans Plans (le libellé nettoyé
   * du numéro de téléphone), null si rien d'exploitable.
   */
  rechercheLibelle: string | null;
};

// Numéros français : 0X XX XX XX XX, avec espaces / points / tirets,
// ou +33 X …, 06 64 19 18 15, 04.76.00.00.00, +33 6 64 19 18 15.
const TELEPHONE_RE =
  /(?:\+33\s?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}\b/;

/** Premier numéro de téléphone français trouvé dans le texte. */
export function extraireTelephone(texte: string | null | undefined): string | null {
  if (!texte) return null;
  const m = TELEPHONE_RE.exec(texte);
  return m ? m[0].trim() : null;
}

/** Numéro prêt pour un lien tel: (chiffres et +, sans espaces). */
export function telephoneNormalise(tel: string): string {
  const compact = tel.replace(/[\s.-]/g, "");
  if (compact.startsWith("+33")) return compact;
  if (/^0\d{9}$/.test(compact)) return `+33${compact.slice(1)}`;
  return compact;
}

export function lienAppel(tel: string): string {
  return `tel:${telephoneNormalise(tel)}`;
}

/** Ouvre Plans / Google Maps / Waze selon le réglage du téléphone. */
export function lienItineraire(adresse: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(adresse.trim())}`;
}

const VOIES =
  "(?:rue|avenue|av\\.?|chemin|ch\\.?|route|rte|impasse|imp\\.?|allée|allee|all\\.?|place|pl\\.?|boulevard|bd|bvd|quai|cours|montée|montee|lotissement|lot\\.?|hameau|square|sentier|passage|traverse|clos|domaine|résidence|residence|za|zi|zac)";

// « 580 chemin de la Croix verte », « 1 Av. du Centenaire, Valgelon-La Rochette »
// Numéro (avec bis/ter) + type de voie + nom, jusqu'à la fin, un
// téléphone, un retour à la ligne ou un séparateur « — » / « · ».
const ADRESSE_RE = new RegExp(
  `\\b(\\d{1,4}\\s?(?:bis|ter|[a-c])?\\s+${VOIES}\\b[^\\n\\r·—|]*)`,
  "i",
);

/**
 * Adresse extraite du texte : un numéro de voie suivi d'un type de
 * voie (rue, chemin, avenue…) et de ce qui suit. Le numéro de
 * téléphone éventuel est retiré de la fin. Null si rien de sûr.
 */
export function extraireAdresse(texte: string | null | undefined): string | null {
  if (!texte) return null;
  const m = ADRESSE_RE.exec(texte);
  if (!m) return null;
  let adresse = m[1]!;
  const tel = extraireTelephone(adresse);
  if (tel) adresse = adresse.slice(0, adresse.indexOf(tel));
  adresse = adresse.replace(/[\s,;:-]+$/g, "").trim();
  // Trop court pour être une adresse (« 12 rue ») → incertain.
  return adresse.split(/\s+/).length >= 3 ? adresse : null;
}

/** Adresse postale d'un client à partir de ses champs. */
export function adresseClient(client: {
  adresse_ligne1?: string | null;
  adresse_ligne2?: string | null;
  code_postal?: string | null;
  ville?: string | null;
}): string | null {
  const parts = [client.adresse_ligne1, client.adresse_ligne2, [client.code_postal, client.ville].filter(Boolean).join(" ")]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Le libellé débarrassé du numéro de téléphone, pour une recherche
 * Plans quand l'adresse n'a pas pu être isolée.
 */
function libelleRecherche(texte: string): string | null {
  let t = texte;
  const tel = extraireTelephone(t);
  if (tel) t = t.replace(tel, "");
  t = t.replace(/\s+/g, " ").replace(/[\s,;:-]+$/g, "").trim();
  // Un seul mot court (« Visite ») ne mène nulle part sur une carte.
  return t.length >= 10 || t.split(" ").length >= 2 ? t : null;
}

/** Tout ce qu'on sait faire avec un évènement : adresse, téléphone, liens. */
export function contactEvenement(e: EvenementContactable): ContactEvenement {
  const texte = [e.title, e.lieu, e.description].filter(Boolean).join("\n");

  let adresse: string | null = null;
  let adresseSource: ContactEvenement["adresseSource"] = null;
  if (e.client_adresse?.trim()) {
    adresse = e.client_adresse.trim();
    adresseSource = "client";
  } else if (e.lieu?.trim()) {
    adresse = e.lieu.trim();
    adresseSource = "lieu";
  } else {
    const extraite = extraireAdresse(texte);
    if (extraite) {
      adresse = extraite;
      adresseSource = "texte";
    }
  }

  let telephone: string | null = null;
  let telephoneSource: ContactEvenement["telephoneSource"] = null;
  if (e.client_telephone && extraireTelephone(e.client_telephone)) {
    telephone = e.client_telephone.trim();
    telephoneSource = "client";
  } else {
    const extrait = extraireTelephone(texte);
    if (extrait) {
      telephone = extrait;
      telephoneSource = "texte";
    }
  }

  return {
    adresse,
    adresseSource,
    telephone,
    telephoneSource,
    rechercheLibelle: adresse ? null : libelleRecherche(e.title),
  };
}
