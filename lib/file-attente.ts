"use client";

import {
  genererId,
  resumerFile,
  type EntreeFile,
  type ResumeFile,
  type TypeEntree,
} from "@/lib/file-attente-helpers";

/**
 * Stockage de la file d'attente hors ligne dans IndexedDB (les photos
 * sont des fichiers : localStorage ne suffirait pas). Chaque changement
 * émet l'évènement `ng:file-attente` sur window pour rafraîchir les
 * badges. Sans IndexedDB (navigation privée ancienne), tout échoue
 * proprement : l'appelant retombe sur le message « Pas de réseau ».
 */
const NOM_BASE = "ng-file-attente";
const MAGASIN = "entrees";
export const EVENEMENT = "ng:file-attente";

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    if (typeof indexedDB === "undefined") {
      rejeter(new Error("IndexedDB indisponible"));
      return;
    }
    const demande = indexedDB.open(NOM_BASE, 1);
    demande.onupgradeneeded = () => {
      const db = demande.result;
      if (!db.objectStoreNames.contains(MAGASIN)) {
        db.createObjectStore(MAGASIN, { keyPath: "id" });
      }
    };
    demande.onsuccess = () => resoudre(demande.result);
    demande.onerror = () => rejeter(demande.error ?? new Error("Ouverture IndexedDB impossible"));
  });
}

function requete<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resoudre, rejeter) => {
    r.onsuccess = () => resoudre(r.result);
    r.onerror = () => rejeter(r.error ?? new Error("Requête IndexedDB en échec"));
  });
}

function signaler(): void {
  try {
    window.dispatchEvent(new CustomEvent(EVENEMENT));
  } catch {
    // Hors navigateur.
  }
}

export async function listerFile(): Promise<EntreeFile[]> {
  const db = await ouvrir();
  try {
    const tx = db.transaction(MAGASIN, "readonly");
    return (await requete(tx.objectStore(MAGASIN).getAll())) as EntreeFile[];
  } finally {
    db.close();
  }
}

export async function ajouterAFile(
  type: TypeEntree,
  payload: Record<string, unknown>,
  id: string = genererId(),
): Promise<EntreeFile> {
  const entree: EntreeFile = {
    id,
    type,
    payload,
    creeLe: new Date().toISOString(),
    tentatives: 0,
    erreur: null,
  };
  const db = await ouvrir();
  try {
    const tx = db.transaction(MAGASIN, "readwrite");
    await requete(tx.objectStore(MAGASIN).put(entree));
  } finally {
    db.close();
  }
  signaler();
  return entree;
}

export async function mettreAJourEntree(entree: EntreeFile): Promise<void> {
  const db = await ouvrir();
  try {
    const tx = db.transaction(MAGASIN, "readwrite");
    await requete(tx.objectStore(MAGASIN).put(entree));
  } finally {
    db.close();
  }
  signaler();
}

export async function supprimerDeFile(id: string): Promise<void> {
  const db = await ouvrir();
  try {
    const tx = db.transaction(MAGASIN, "readwrite");
    await requete(tx.objectStore(MAGASIN).delete(id));
  } finally {
    db.close();
  }
  signaler();
}

export async function resumeFile(): Promise<ResumeFile> {
  try {
    return resumerFile(await listerFile());
  } catch {
    return { total: 0, enAttente: 0, enErreur: 0 };
  }
}
