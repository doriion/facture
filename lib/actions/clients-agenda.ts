"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createClientAction } from "@/lib/actions/clients";
import { telephoneNormalise } from "@/lib/agenda-contact";
import type { ClientDetecte } from "@/lib/client-depuis-evenement";
import { REGEX } from "@/lib/format";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ClientEnregistreDepuisAgenda = {
  id: string;
  nom: string;
  /** true : une fiche existait déjà (même téléphone ou même nom), reprise telle quelle. */
  existant: boolean;
  /** true : le client a été rattaché à l'intervention indiquée. */
  rattache: boolean;
};

/**
 * Enregistre en un clic le client détecté dans un rendez-vous
 * (lib/client-depuis-evenement) : fiche « particulier » avec nom,
 * téléphone, e-mail et adresse. Un téléphone ou un e-mail mal formé est
 * laissé de côté plutôt que de bloquer. Si une fiche porte déjà ce
 * numéro (ou exactement ce nom), on la reprend : pas de doublon.
 * Avec `interventionId`, le client est rattaché à l'intervention si
 * elle n'en a pas encore.
 */
export async function enregistrerClientDetecteAction(
  detecte: ClientDetecte,
  interventionId?: string | null,
): Promise<ActionResult<ClientEnregistreDepuisAgenda>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const nom = (detecte.nom ?? "").replace(/\s+/g, " ").trim().slice(0, 150);
  if (!nom) return { ok: false, error: "Aucun nom de client détecté." };
  const telephone =
    detecte.telephone && REGEX.telephoneFr.test(detecte.telephone.trim()) ? detecte.telephone.trim() : "";
  const email =
    detecte.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(detecte.email.trim()) ? detecte.email.trim() : "";
  const code_postal =
    detecte.code_postal && REGEX.codePostal.test(detecte.code_postal.trim()) ? detecte.code_postal.trim() : "";

  // Doublon : même numéro (quelle que soit l'écriture) ou même nom.
  let existant: { id: string; nom: string } | null = null;
  if (telephone) {
    const cible = telephoneNormalise(telephone);
    const { data: avecTel } = await supabase
      .from("clients")
      .select("id, nom, telephone")
      .not("telephone", "is", null);
    existant =
      (avecTel ?? []).find((c) => c.telephone && telephoneNormalise(c.telephone) === cible) ?? null;
  }
  if (!existant) {
    const { data: memeNom } = await supabase
      .from("clients")
      .select("id, nom")
      .ilike("nom", nom.replace(/[%_\\]/g, (ch) => `\\${ch}`))
      .limit(1);
    existant = memeNom?.[0] ?? null;
  }

  let id: string;
  if (existant) {
    id = existant.id;
  } else {
    const cree = await createClientAction({
      nom,
      type: "particulier",
      siret: "",
      raison_sociale: "",
      adresse_ligne1: (detecte.adresse_ligne1 ?? "").trim().slice(0, 200),
      adresse_ligne2: "",
      code_postal,
      ville: (detecte.ville ?? "").trim().slice(0, 100),
      pays: "France",
      email,
      telephone,
      notes: "",
    });
    if (!cree.ok) return cree;
    id = cree.data.id;
  }

  let rattache = false;
  if (interventionId) {
    const { data: maj, error } = await supabase
      .from("interventions")
      .update({ client_id: id })
      .eq("id", interventionId)
      .is("client_id", null)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    rattache = Boolean(maj);
    revalidatePath(`/interventions/${interventionId}`);
    revalidatePath("/interventions");
  }
  revalidatePath("/agenda");
  revalidatePath("/clients");
  return { ok: true, data: { id, nom: existant?.nom ?? nom, existant: Boolean(existant), rattache } };
}
