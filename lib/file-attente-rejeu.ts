"use client";

import { createTacheAction, setTacheFaitAction, uploadTachePhotoAction } from "@/lib/actions/taches";
import { createInterventionAction } from "@/lib/actions/interventions";
import { uploadInterventionPhotoAction } from "@/lib/actions/intervention-photos";
import { setCouleursEvenementsAction } from "@/lib/actions/agenda-couleurs";
import { addPaiementAction } from "@/lib/actions/paiements";
import {
  estErreurReseau,
  idParent,
  ordonnerPourRejeu,
  type EntreeFile,
} from "@/lib/file-attente-helpers";
import { listerFile, mettreAJourEntree, supprimerDeFile } from "@/lib/file-attente";
import type { InterventionFormValues } from "@/lib/validations/intervention";
import type { TacheFormInput } from "@/lib/validations/tache";

type Resultat = { ok: true } | { ok: false; error: string };

/** Envoie UNE entrée au serveur (même action qu'en ligne, même identifiant). */
async function envoyer(e: EntreeFile): Promise<Resultat> {
  const p = e.payload;
  switch (e.type) {
    case "tache_fait":
      return setTacheFaitAction(String(p.id), Boolean(p.fait));
    case "tache_creer":
      return createTacheAction({ ...(p.input as TacheFormInput), id: e.id });
    case "rdv_creer":
      return createInterventionAction({ ...(p.values as InterventionFormValues), id: e.id });
    case "couleur_evenements":
      return setCouleursEvenementsAction(p.cles as string[], (p.couleur as string | null) ?? null);
    case "paiement_ajouter":
      return addPaiementAction(String(p.factureId), {
        id: e.id,
        date_paiement: String(p.date_paiement),
        montant: p.montant as string | number,
        mode: String(p.mode),
      });
    case "photo_tache": {
      const fd = new FormData();
      fd.append("id", e.id);
      fd.append("file", p.file as File);
      return uploadTachePhotoAction(String(p.tacheId), fd);
    }
    case "photo_intervention": {
      const fd = new FormData();
      fd.append("id", e.id);
      fd.append("file", p.file as File);
      fd.append("moment", String(p.moment ?? "autre"));
      fd.append("legende", String(p.legende ?? ""));
      return uploadInterventionPhotoAction(String(p.interventionId), fd);
    }
    default:
      return { ok: false, error: "Type d'entrée inconnu." };
  }
}

let enCours: Promise<{ envoyees: number; enErreur: number; reseauCoupe: boolean }> | null = null;

/**
 * Rejoue toute la file, dans l'ordre. S'arrête au premier échec RÉSEAU
 * (on réessaiera au prochain retour de connexion) ; un refus du serveur
 * marque l'entrée en erreur et continue. Un seul rejeu à la fois.
 */
export function rejouerFile(): Promise<{ envoyees: number; enErreur: number; reseauCoupe: boolean }> {
  if (enCours) return enCours;
  enCours = (async () => {
    let envoyees = 0;
    let enErreur = 0;
    let reseauCoupe = false;
    let entrees: EntreeFile[] = [];
    try {
      entrees = ordonnerPourRejeu(await listerFile());
    } catch {
      return { envoyees, enErreur, reseauCoupe };
    }
    const enErreurIds = new Set(entrees.filter((x) => x.erreur).map((x) => x.id));
    for (const e of entrees) {
      if (e.erreur) {
        enErreur += 1;
        continue;
      }
      const parent = idParent(e);
      if (parent && enErreurIds.has(parent)) {
        // Le parent a été refusé : cette entrée ne peut pas passer.
        await mettreAJourEntree({ ...e, erreur: "En attente d'une entrée refusée (voir plus haut)." });
        enErreur += 1;
        continue;
      }
      let res: Resultat;
      try {
        res = await envoyer(e);
      } catch (err) {
        res = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      if (res.ok) {
        await supprimerDeFile(e.id);
        envoyees += 1;
      } else if (estErreurReseau(res.error) || (typeof navigator !== "undefined" && navigator.onLine === false)) {
        reseauCoupe = true;
        await mettreAJourEntree({ ...e, tentatives: e.tentatives + 1 });
        break;
      } else {
        await mettreAJourEntree({ ...e, tentatives: e.tentatives + 1, erreur: res.error });
        enErreurIds.add(e.id);
        enErreur += 1;
      }
    }
    return { envoyees, enErreur, reseauCoupe };
  })().finally(() => {
    enCours = null;
  });
  return enCours;
}

/** Réessaie une entrée refusée (après correction côté serveur, par exemple). */
export async function reessayerEntree(id: string): Promise<void> {
  const entrees = await listerFile();
  const e = entrees.find((x) => x.id === id);
  if (!e) return;
  await mettreAJourEntree({ ...e, erreur: null });
  await rejouerFile();
}
