/**
 * Lecture d'une plaque signalétique à partir du texte reconnu (OCR) :
 * marque, modèle, numéro de série, fluide, charge. Logique PURE testée.
 * L'OCR se trompe souvent (O/0, I/1) : on reste tolérant et c'est
 * l'utilisateur qui valide, champ par champ.
 */

export const MARQUES_CONNUES = [
  "Daikin", "Mitsubishi Electric", "Mitsubishi", "Toshiba", "Panasonic", "Hitachi", "Fujitsu", "LG", "Samsung", "Gree", "Midea", "Haier",
  "Atlantic", "Thermor", "Saunier Duval", "Vaillant", "Viessmann", "De Dietrich", "Chaffoteaux", "Ariston", "Elm Leblanc", "Bosch", "Frisquet",
  "Chappée", "Auer", "Airwell", "Technibel", "Carrier", "Hisense", "Stiebel Eltron", "Ciat", "Aermec", "Clivet", "Trane", "Lennox", "Daikin Altherma",
  "Grundfos", "Wilo", "Salmson", "Riello", "Weishaupt", "Cuenod", "Oertli", "Fondital", "Sime", "Baxi", "Immergas", "Styx", "Styx", "Nibe", "Hoval",
];

export type LecturePlaque = {
  marque: string | null;
  modele: string | null;
  numSerie: string | null;
  fluide: string | null;
  chargeKg: number | null;
  texte: string;
};

const nettoyer = (s: string) => s.replace(/\s+/g, " ").trim();

function trouverMarque(texte: string): string | null {
  const t = texte.toLowerCase();
  // Les noms composés d'abord (« Mitsubishi Electric » avant « Mitsubishi »).
  const candidates = [...MARQUES_CONNUES].sort((a, b) => b.length - a.length);
  for (const m of candidates) {
    const motif = new RegExp(`(^|[^a-z])${m.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i");
    if (motif.test(t)) return m === "Daikin Altherma" ? "Daikin" : m;
  }
  return null;
}

/** Valeur après une étiquette (« Model : XXX », « S/N XXX »), sur la même ligne. */
function apresEtiquette(texte: string, etiquettes: RegExp): string | null {
  for (const ligne of texte.split(/\r?\n/)) {
    const m = etiquettes.exec(ligne);
    if (m) {
      const valeur = nettoyer(ligne.slice(m.index + m[0].length).replace(/^[\s:.=\-–#°]+/, ""));
      // La valeur s'arrête à l'étiquette suivante sur la même ligne
      // (« REF 522456 SN 2B1234567 ») ou à un double espace.
      const jeton = valeur.split(/\s{2,}|\s(?=[A-Za-z]+\s*[:=])|\s+(?=(?:s\/n|sn|serial|n[°o]|mod[èe]le|model|type|typ|ref)\b)/i)[0] ?? "";
      const propre = jeton.replace(/[^A-Za-z0-9\-\/.]+$/g, "").trim();
      if (propre.length >= 3) return propre;
    }
  }
  return null;
}

/** Jeton ressemblant à une référence (lettres + chiffres, ≥ 6, pas un mot). */
function jetonReference(texte: string, exclure: string[]): string | null {
  const jetons = texte.match(/[A-Z0-9][A-Z0-9\-\/.]{5,}/g) ?? [];
  for (const j of jetons) {
    if (exclure.includes(j)) continue;
    if (/\d/.test(j) && /[A-Z]/.test(j)) return j;
  }
  return null;
}

export function lirePlaque(texteOcr: string): LecturePlaque {
  const texte = texteOcr.replace(/\u0000/g, "");
  const marque = trouverMarque(texte);
  const modele = apresEtiquette(texte, /\b(mod[èe]le|model|type|typ|ref(?:erence)?|r[ée]f\.?)\b/i);
  let numSerie = apresEtiquette(texte, /\b(s\/n|sn|serial(?:\s*no\.?|\s*number)?|n[°o]?\s*(?:de\s*)?s[ée]rie|serie|ser\.?\s*no\.?)\b/i);
  if (numSerie && numSerie.toLowerCase().startsWith("no")) numSerie = numSerie.slice(2).replace(/^[\s:.]+/, "") || null;
  const fluideM = /\bR[\s-]?(32|410A|407C|134A|290|454B|407F|22|1234YF)\b/i.exec(texte);
  const fluide = fluideM ? `R${fluideM[1]!.toUpperCase()}` : null;
  const chargeM = /(\d+(?:[.,]\d+)?)\s*kg/i.exec(texte);
  const chargeKg = chargeM ? Number(chargeM[1]!.replace(",", ".")) : null;

  const exclure = [modele, numSerie].filter((x): x is string => Boolean(x));
  const modeleFinal = modele ?? jetonReference(texte, exclure);
  const numSerieFinal = numSerie ?? (modeleFinal ? jetonReference(texte, [...exclure, modeleFinal]) : null);

  return { marque, modele: modeleFinal, numSerie: numSerieFinal, fluide, chargeKg, texte };
}
