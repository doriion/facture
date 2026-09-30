/**
 * Archive ZIP minimale (entrées « stored », sans compression), sans
 * dépendance : sert à joindre les fichiers du Storage (PDF signés,
 * signatures, CERFA, bons, logo, photos) à la sauvegarde. Les PDF et
 * PNG sont déjà compressés, la compression n'apporterait rien.
 *
 * Format : en-têtes locaux + répertoire central + fin de répertoire
 * (APPNOTE 4.4.x). Noms en UTF-8 (drapeau bit 11). Pas de ZIP64 : une
 * archive reste bien en dessous de 4 Go (budget de la sauvegarde).
 */

export type EntreeZip = {
  /** Chemin dans l'archive, séparateur « / », sans « / » initial. */
  nom: string;
  contenu: Uint8Array;
  /** Date de modification (défaut : époque DOS minimale, 1980-01-01). */
  date?: Date;
};

const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(donnees: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < donnees.length; i++) {
    c = TABLE_CRC[(c ^ donnees[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dateDos(d: Date): { heure: number; jour: number } {
  const annee = Math.max(1980, d.getUTCFullYear());
  const jour = ((annee - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  const heure = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1);
  return { heure, jour };
}

function u16(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff];
}
function u32(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

/** Construit l'archive en mémoire. Les noms en double sont refusés. */
export function construireZip(entrees: EntreeZip[]): Uint8Array {
  const enc = new TextEncoder();
  const vus = new Set<string>();
  const locaux: Uint8Array[] = [];
  const central: number[] = [];
  let decalage = 0;

  for (const e of entrees) {
    const nom = e.nom.replace(/^\/+/, "");
    if (vus.has(nom)) throw new Error(`Entrée en double dans l'archive : ${nom}`);
    vus.add(nom);
    const nomOctets = enc.encode(nom);
    const crc = crc32(e.contenu);
    const { heure, jour } = dateDos(e.date ?? new Date(Date.UTC(1980, 0, 1)));
    const taille = e.contenu.length;

    const enTete = new Uint8Array([
      ...u32(0x04034b50), // signature locale
      ...u16(20), // version requise
      ...u16(0x0800), // drapeaux : noms UTF-8
      ...u16(0), // méthode : stored
      ...u16(heure),
      ...u16(jour),
      ...u32(crc),
      ...u32(taille),
      ...u32(taille),
      ...u16(nomOctets.length),
      ...u16(0), // extra
    ]);
    locaux.push(enTete, nomOctets, e.contenu);

    const fiche = [
      ...u32(0x02014b50), // signature centrale
      ...u16(20), // version créée par
      ...u16(20),
      ...u16(0x0800),
      ...u16(0),
      ...u16(heure),
      ...u16(jour),
      ...u32(crc),
      ...u32(taille),
      ...u32(taille),
      ...u16(nomOctets.length),
      ...u16(0), // extra
      ...u16(0), // commentaire
      ...u16(0), // disque
      ...u16(0), // attributs internes
      ...u32(0), // attributs externes
      ...u32(decalage),
    ];
    for (let i = 0; i < nomOctets.length; i++) fiche.push(nomOctets[i]!);
    for (const o of fiche) central.push(o);
    decalage += enTete.length + nomOctets.length + taille;
  }

  const fin = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entrees.length),
    ...u16(entrees.length),
    ...u32(central.length),
    ...u32(decalage),
    ...u16(0),
  ];

  const total = decalage + central.length + fin.length;
  const sortie = new Uint8Array(total);
  let pos = 0;
  for (const bloc of locaux) {
    sortie.set(bloc, pos);
    pos += bloc.length;
  }
  sortie.set(central, pos);
  pos += central.length;
  sortie.set(fin, pos);
  return sortie;
}

/**
 * Lecture minimale (pour les tests et le contrôle d'une archive
 * produite ici) : renvoie les entrées « stored » d'une archive.
 */
export function lireZip(archive: Uint8Array): EntreeZip[] {
  const vue = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const dec = new TextDecoder();
  // Fin de répertoire : dernière signature 0x06054b50
  let finPos = -1;
  for (let i = archive.length - 22; i >= 0; i--) {
    if (vue.getUint32(i, true) === 0x06054b50) {
      finPos = i;
      break;
    }
  }
  if (finPos < 0) throw new Error("Archive invalide : fin de répertoire absente.");
  const nb = vue.getUint16(finPos + 10, true);
  let pos = vue.getUint32(finPos + 16, true);
  const entrees: EntreeZip[] = [];
  for (let i = 0; i < nb; i++) {
    if (vue.getUint32(pos, true) !== 0x02014b50) throw new Error("Archive invalide : répertoire central.");
    const crcAttendu = vue.getUint32(pos + 16, true);
    const taille = vue.getUint32(pos + 24, true);
    const nomLong = vue.getUint16(pos + 28, true);
    const extraLong = vue.getUint16(pos + 30, true);
    const commLong = vue.getUint16(pos + 32, true);
    const local = vue.getUint32(pos + 42, true);
    const nom = dec.decode(archive.subarray(pos + 46, pos + 46 + nomLong));
    const nomLocalLong = vue.getUint16(local + 26, true);
    const extraLocalLong = vue.getUint16(local + 28, true);
    const debut = local + 30 + nomLocalLong + extraLocalLong;
    const contenu = archive.slice(debut, debut + taille);
    if (crc32(contenu) !== crcAttendu) throw new Error(`Archive invalide : CRC de ${nom}.`);
    entrees.push({ nom, contenu });
    pos += 46 + nomLong + extraLong + commLong;
  }
  return entrees;
}
