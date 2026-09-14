/**
 * Remplacement des lignes d'un document. PAS un fichier "use server" :
 * helper importé par les server actions (devis, factures).
 *
 * L'édition remplaçait les lignes en deux requêtes indépendantes
 * (DELETE puis INSERT) : un échec de l'INSERT laissait le document
 * sans aucune ligne alors que son total restait inchangé. La RPC
 * `remplacer_lignes_document` fait les deux dans une seule
 * transaction, avec vérification du propriétaire côté base.
 *
 * Repli : tant que la migration n'est pas appliquée (la fonction
 * n'existe pas encore), on retombe automatiquement sur l'ancien
 * comportement — le déploiement du code ne dépend donc pas de l'ordre
 * d'application de la migration.
 */

import type { createClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createClient>;

export type LignePayload = {
  ordre: number;
  designation: string;
  nature_fiscale: string;
  type: string;
  quantite: number;
  prix_unitaire_ht: number;
  prix_achat_ttc_unitaire: number | null;
  fournisseur: string | null;
  total_ht: number;
};

type Resultat = { ok: true } | { ok: false; error: string };

/** Codes renvoyés quand la fonction n'existe pas encore en base. */
const CODES_FONCTION_ABSENTE = new Set(["PGRST202", "42883", "42P01"]);

export async function remplacerLignesDocument(
  supabase: Supabase,
  type: "devis" | "facture",
  documentId: string,
  userId: string,
  lignes: LignePayload[],
): Promise<Resultat> {
  const { error } = await supabase.rpc("remplacer_lignes_document", {
    p_type: type,
    p_document_id: documentId,
    p_lignes: lignes,
  });

  if (!error) return { ok: true };

  const code = (error as { code?: string }).code ?? "";
  const absente =
    CODES_FONCTION_ABSENTE.has(code) ||
    /could not find the function|does not exist/i.test(error.message ?? "");
  if (!absente) return { ok: false, error: error.message };

  return repliDeuxRequetes(supabase, type, documentId, userId, lignes);
}

/** Ancien comportement (deux requêtes), conservé comme repli. */
async function repliDeuxRequetes(
  supabase: Supabase,
  type: "devis" | "facture",
  documentId: string,
  userId: string,
  lignes: LignePayload[],
): Promise<Resultat> {
  // Tables nommées littéralement dans chaque branche : le client
  // Supabase typé refuse un nom de table calculé.
  if (type === "devis") {
    const { error: deleteErr } = await supabase
      .from("devis_lignes")
      .delete()
      .eq("devis_id", documentId);
    if (deleteErr) return { ok: false, error: deleteErr.message };

    const { error: insertErr } = await supabase
      .from("devis_lignes")
      .insert(
        lignes.map((l) => ({ ...l, user_id: userId, devis_id: documentId })),
      );
    if (insertErr) return { ok: false, error: insertErr.message };
    return { ok: true };
  }

  const { error: deleteErr } = await supabase
    .from("factures_lignes")
    .delete()
    .eq("facture_id", documentId);
  if (deleteErr) return { ok: false, error: deleteErr.message };

  const { error: insertErr } = await supabase
    .from("factures_lignes")
    .insert(
      lignes.map((l) => ({ ...l, user_id: userId, facture_id: documentId })),
    );
  if (insertErr) return { ok: false, error: insertErr.message };
  return { ok: true };
}
