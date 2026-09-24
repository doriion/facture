/**
 * File d'attente hors ligne — partie PURE (types, libellés, décisions),
 * testée dans file-attente-helpers.test.ts. Le stockage (IndexedDB) est
 * dans lib/file-attente.ts, le rejeu dans lib/file-attente-rejeu.ts.
 *
 * Principe : chaque modification faite sans réseau porte un identifiant
 * choisi par le téléphone (UUID). Le serveur l'utilise tel quel : si la
 * même entrée est rejouée deux fois (réseau coupé pendant l'envoi), la
 * seconde ne crée rien de plus.
 */

export type TypeEntree =
  | "tache_fait"
  | "tache_creer"
  | "photo_tache"
  | "rdv_creer"
  | "couleur_evenements"
  | "paiement_ajouter"
  | "photo_intervention";

export type EntreeFile = {
  /** Identifiant de l'entrée ET de l'objet créé (UUID côté téléphone). */
  id: string;
  type: TypeEntree;
  /** Données de l'action ; les fichiers (photos) sont des File/Blob. */
  payload: Record<string, unknown>;
  creeLe: string;
  tentatives: number;
  /** Refus du serveur (pas un problème de réseau) : l'entrée attend une décision. */
  erreur?: string | null;
};

export function genererId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // Secours (contexte non sécurisé) : UUID v4 à partir de getRandomValues.
  const octets = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(octets);
  else for (let i = 0; i < 16; i++) octets[i] = Math.floor(Math.random() * 256);
  octets[6] = (octets[6]! & 0x0f) | 0x40;
  octets[8] = (octets[8]! & 0x3f) | 0x80;
  const hex = Array.from(octets, (o) => o.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Libellé court d'une entrée, pour le bandeau et le panneau. */
export function libelleEntree(e: EntreeFile): string {
  const p = e.payload;
  switch (e.type) {
    case "tache_fait":
      return `${p.fait ? "Tâche faite" : "Tâche à refaire"}${p.titre ? ` : ${String(p.titre)}` : ""}`;
    case "tache_creer":
      return `Nouvelle tâche${p.titre ? ` : ${String(p.titre)}` : ""}`;
    case "photo_tache":
      return "Photo de tâche";
    case "rdv_creer":
      return `Rendez-vous${p.date_intervention ? ` du ${String(p.date_intervention)}` : ""}${
        p.clientNom ? ` — ${String(p.clientNom)}` : ""
      }`;
    case "couleur_evenements":
      return "Couleur de rendez-vous";
    case "paiement_ajouter":
      return `Paiement${p.montantTexte ? ` de ${String(p.montantTexte)}` : ""}${
        p.numero ? ` sur ${String(p.numero)}` : ""
      }`;
    case "photo_intervention":
      return "Photo d'intervention";
    default:
      return "Modification";
  }
}

export type ResumeFile = { total: number; enAttente: number; enErreur: number };

export function resumerFile(entrees: EntreeFile[]): ResumeFile {
  const enErreur = entrees.filter((e) => e.erreur).length;
  return { total: entrees.length, enAttente: entrees.length - enErreur, enErreur };
}

/** Ordre de rejeu : par date, les créations avant ce qui en dépend. */
export function ordonnerPourRejeu(entrees: EntreeFile[]): EntreeFile[] {
  const rang: Record<TypeEntree, number> = {
    tache_creer: 0,
    rdv_creer: 0,
    tache_fait: 1,
    photo_tache: 1,
    couleur_evenements: 1,
    paiement_ajouter: 1,
    photo_intervention: 1,
  };
  return [...entrees].sort((a, b) => {
    if (a.creeLe !== b.creeLe) return a.creeLe < b.creeLe ? -1 : 1;
    return rang[a.type] - rang[b.type];
  });
}

/**
 * Une entrée dépend-elle d'une autre encore en attente (photo d'une
 * tâche créée hors ligne, couleur d'un rendez-vous créé hors ligne) ?
 * Si oui et que cette autre est en erreur, l'entrée est bloquée.
 */
export function idParent(e: EntreeFile): string | null {
  if (e.type === "photo_tache") return String(e.payload.tacheId ?? "") || null;
  if (e.type === "photo_intervention") return String(e.payload.interventionId ?? "") || null;
  if (e.type === "couleur_evenements") {
    const cles = e.payload.cles;
    if (Array.isArray(cles) && cles.length === 1) return String(cles[0]).replace(/^intervention:/, "");
  }
  return null;
}

/** Une erreur de résultat d'action qui vient du réseau (et non du serveur). */
export function estErreurReseau(message: string): boolean {
  return /pas de réseau|Failed to fetch|Load failed|network|réseau|fetch/i.test(message);
}
