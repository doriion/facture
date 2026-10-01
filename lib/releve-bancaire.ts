/**
 * Lecture d'un relevé bancaire CSV et rapprochement avec les factures
 * impayées — logique PURE, testée. Les banques françaises exportent
 * des CSV très différents (séparateur « ; » ou « , », dates au format
 * JJ/MM/AAAA, montants « 1 234,56 », ou colonnes Débit / Crédit
 * séparées) : on repère les colonnes par leur nom, sans format imposé.
 * Seuls les CRÉDITS (argent reçu) sont retenus.
 */

export type OperationBancaire = {
  /** Numéro de ligne dans le fichier (pour l'affichage). */
  ligne: number;
  date: string; // YYYY-MM-DD
  libelle: string;
  montant: number; // > 0
};

export type LectureReleve = {
  operations: OperationBancaire[];
  /** Lignes ignorées (illisibles, débits…). */
  nbIgnorees: number;
  erreur: string | null;
};

const SEPARATEURS = [";", ",", "\t"] as const;

/** Découpe une ligne CSV en champs, guillemets compris. */
export function decouperLigne(ligne: string, sep: string): string[] {
  const champs: string[] = [];
  let courant = "";
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]!;
    if (c === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') {
        courant += '"';
        i++;
      } else {
        entreGuillemets = !entreGuillemets;
      }
    } else if (c === sep && !entreGuillemets) {
      champs.push(courant);
      courant = "";
    } else {
      courant += c;
    }
  }
  champs.push(courant);
  return champs.map((c) => c.trim());
}

function detecterSeparateur(entete: string): string {
  let meilleur: string = ";";
  let max = -1;
  for (const s of SEPARATEURS) {
    const n = decouperLigne(entete, s).length;
    if (n > max) {
      max = n;
      meilleur = s;
    }
  }
  return meilleur;
}

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/** Montant « 1 234,56 », « -12.30 », « +1 234,56 € », « (12,00) » → nombre ; NaN si illisible. */
export function lireMontant(brut: string): number {
  let s = brut.replace(/[€\s\u00a0]/g, "").trim();
  if (s === "") return NaN;
  let signe = 1;
  if (/^\(.*\)$/.test(s)) {
    signe = -1;
    s = s.slice(1, -1);
  }
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("-")) {
    signe = -1;
    s = s.slice(1);
  }
  // « 1.234,56 » (point = milliers) ou « 1234.56 » (point = décimal)
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return signe * Number(s);
}

/** « 30/09/2026 », « 2026-09-30 », « 30-09-2026 », « 30/09/26 » → YYYY-MM-DD ; null si illisible. */
export function lireDate(brut: string): string | null {
  const s = brut.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s);
  if (m) {
    const annee = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    const mois = m[2]!.padStart(2, "0");
    const jour = m[1]!.padStart(2, "0");
    if (Number(mois) < 1 || Number(mois) > 12 || Number(jour) < 1 || Number(jour) > 31) return null;
    return `${annee}-${mois}-${jour}`;
  }
  return null;
}

type Colonnes = { date: number; libelle: number[]; montant: number | null; debit: number | null; credit: number | null };

function reconnaitreColonnes(entete: string[]): Colonnes | null {
  const n = entete.map(normaliser);
  const trouver = (motifs: RegExp[]) => n.findIndex((c) => motifs.some((r) => r.test(c)));
  const date = trouver([/^date$/, /date.*op/, /date.*compta/, /^date de valeur/, /^date/]);
  const credit = trouver([/^credit/, /^montant.*credit/]);
  const debit = trouver([/^debit/, /^montant.*debit/]);
  let montant = trouver([/^montant$/, /^montant/, /^amount/]);
  if (montant === credit || montant === debit) montant = -1;
  const libelle = n
    .map((c, i) => (/(libel|label|description|intitul|motif|communication|nom|beneficiaire|designation|details|detail|reference|^ref)/.test(c) ? i : -1))
    .filter((i) => i >= 0);
  if (date < 0 || (montant < 0 && credit < 0)) return null;
  return {
    date,
    libelle: libelle.length > 0 ? libelle : n.map((_, i) => i).filter((i) => i !== date && i !== montant && i !== credit && i !== debit),
    montant: montant >= 0 ? montant : null,
    debit: debit >= 0 ? debit : null,
    credit: credit >= 0 ? credit : null,
  };
}

/** Lit un CSV de relevé ; ne garde que les crédits. */
export function lireReleveCsv(texte: string): LectureReleve {
  // Numéros de ligne = ceux du fichier (lignes vides comprises), pour
  // que l'utilisateur retrouve l'opération dans son relevé.
  const brutes = texte.replace(/^\uFEFF/, "").split(/\r?\n/);
  const numeros = brutes.map((_, i) => i + 1).filter((i) => brutes[i - 1]!.trim().length > 0);
  const lignes = numeros.map((i) => brutes[i - 1]!);
  if (lignes.length < 2) return { operations: [], nbIgnorees: 0, erreur: "Fichier vide ou sans ligne d'opération." };

  // L'en-tête n'est pas forcément la première ligne (préambule de
  // certaines banques) : on prend la première ligne reconnue.
  let indexEntete = -1;
  let sep = ";";
  let colonnes: Colonnes | null = null;
  for (let i = 0; i < Math.min(lignes.length, 20); i++) {
    const s = detecterSeparateur(lignes[i]!);
    const c = reconnaitreColonnes(decouperLigne(lignes[i]!, s));
    if (c) {
      indexEntete = i;
      sep = s;
      colonnes = c;
      break;
    }
  }
  if (!colonnes) {
    return {
      operations: [],
      nbIgnorees: lignes.length,
      erreur: "Colonnes non reconnues : il faut au moins une colonne Date et une colonne Montant (ou Crédit).",
    };
  }

  const operations: OperationBancaire[] = [];
  let nbIgnorees = 0;
  for (let i = indexEntete + 1; i < lignes.length; i++) {
    const champs = decouperLigne(lignes[i]!, sep);
    const date = lireDate(champs[colonnes.date] ?? "");
    let montant = NaN;
    if (colonnes.montant !== null) {
      montant = lireMontant(champs[colonnes.montant] ?? "");
    } else {
      const credit = lireMontant(champs[colonnes.credit!] ?? "");
      const debit = colonnes.debit !== null ? lireMontant(champs[colonnes.debit] ?? "") : NaN;
      montant = Number.isFinite(credit) && credit !== 0 ? Math.abs(credit) : Number.isFinite(debit) ? -Math.abs(debit) : NaN;
    }
    if (!date || !Number.isFinite(montant) || montant <= 0) {
      nbIgnorees++;
      continue;
    }
    const libelle = colonnes.libelle
      .map((idx) => champs[idx] ?? "")
      .filter((v) => v.length > 0)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    operations.push({ ligne: numeros[i]!, date, libelle, montant: Math.round(montant * 100) / 100 });
  }
  return { operations, nbIgnorees, erreur: null };
}

// ---------------------------------------------------------------------------
// Rapprochement
// ---------------------------------------------------------------------------

export type FactureARapprocher = {
  id: string;
  numero: string;
  client_nom: string | null;
  date_emission: string;
  reste_du: number;
  /** Paiements déjà enregistrés (date, montant) pour détecter un doublon. */
  paiements: Array<{ date_paiement: string; montant: number }>;
};

export type Rapprochement = {
  operation: OperationBancaire;
  facture: FactureARapprocher | null;
  /** 0 = aucune piste ; ≥ 5 = quasi certain. */
  score: number;
  raisons: string[];
  /** Un paiement de ce montant existe déjà sur la facture à ± 3 jours. */
  dejaEnregistre: boolean;
};

const joursEntre = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86_400_000);

/** Chiffres significatifs d'un numéro de facture (« F-2026-0012 » → « 20260012 », « 0012 » → « 12 »). */
function chiffresNumero(numero: string): string[] {
  const groupes = numero.match(/\d+/g) ?? [];
  const tout = groupes.join("");
  const dernier = groupes.at(-1) ?? "";
  return [tout, numero.replace(/[^a-z0-9]/gi, "").toLowerCase(), dernier.replace(/^0+/, "")].filter((s) => s.length >= 2);
}

function motsClient(nom: string | null): string[] {
  return normaliser(nom ?? "")
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 3 && !["sarl", "sas", "eurl", "monsieur", "madame", "mme", "les", "des"].includes(m));
}

/** Score d'une facture pour une opération, avec les raisons lisibles. */
export function scoreRapprochement(op: OperationBancaire, f: FactureARapprocher): { score: number; raisons: string[] } {
  let score = 0;
  const raisons: string[] = [];
  const lib = normaliser(op.libelle);
  const libCompact = lib.replace(/[^a-z0-9]/g, "");

  if (chiffresNumero(f.numero).some((c) => libCompact.includes(c.toLowerCase()))) {
    score += 5;
    raisons.push("numéro de facture dans le libellé");
  }
  if (Math.abs(op.montant - f.reste_du) < 0.005) {
    // Seul, un montant égal ne suffit pas (deux factures de 500 €) :
    // il faut aussi le nom ou le numéro.
    score += 2.5;
    raisons.push("montant égal au reste dû");
  } else if (op.montant < f.reste_du) {
    score += 0.5;
    raisons.push("montant partiel");
  } else {
    score -= 2;
  }
  const mots = motsClient(f.client_nom);
  const motsTrouves = mots.filter((m) => lib.includes(m));
  if (mots.length > 0 && motsTrouves.length > 0) {
    score += motsTrouves.length >= 2 || motsTrouves.length === mots.length ? 3 : 2;
    raisons.push("nom du client dans le libellé");
  }
  if (op.date < f.date_emission) {
    score -= 2;
    raisons.push("virement antérieur à la facture");
  }
  return { score: Math.round(score * 10) / 10, raisons };
}

/** Pour chaque crédit, la facture la plus vraisemblable (score ≥ 3), sans attribuer deux fois la même facture au même montant exact. */
export function rapprocher(operations: OperationBancaire[], factures: FactureARapprocher[]): Rapprochement[] {
  const resultats: Rapprochement[] = [];
  const attribuees = new Set<string>();
  for (const op of operations) {
    let meilleur: { f: FactureARapprocher; score: number; raisons: string[] } | null = null;
    for (const f of factures) {
      if (attribuees.has(f.id)) continue;
      const { score, raisons } = scoreRapprochement(op, f);
      if (score >= 3 && (!meilleur || score > meilleur.score)) meilleur = { f, score, raisons };
    }
    if (meilleur) {
      attribuees.add(meilleur.f.id);
      const dejaEnregistre = meilleur.f.paiements.some(
        (p) => Math.abs(p.montant - op.montant) < 0.005 && joursEntre(p.date_paiement, op.date) <= 3,
      );
      resultats.push({ operation: op, facture: meilleur.f, score: meilleur.score, raisons: meilleur.raisons, dejaEnregistre });
    } else {
      resultats.push({ operation: op, facture: null, score: 0, raisons: [], dejaEnregistre: false });
    }
  }
  return resultats;
}
