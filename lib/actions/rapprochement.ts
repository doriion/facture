"use server";

import { createClient } from "@/lib/supabase/server";
import { idsParentsVentiles } from "@/lib/actions/factures";
import { addPaiementAction } from "@/lib/actions/paiements";
import { montantRestant } from "@/lib/paiements-helpers";
import { TYPE_AVOIR } from "@/lib/factures-transitions";
import type { FactureARapprocher } from "@/lib/releve-bancaire";

/**
 * Factures envoyées avec un reste dû, pour le rapprochement bancaire :
 * même calcul du reste dû que la fiche facture (paiements + avoirs
 * imputés), factures ventilées en acomptes/solde exclues (ce sont
 * leurs enfants qui s'encaissent).
 */
export async function getFacturesARapprocher(): Promise<FactureARapprocher[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: factures }, parentsVentiles] = await Promise.all([
    supabase
      .from("factures")
      .select("id, numero, date_emission, total_ht, client:clients(nom), paiements(date_paiement, montant)")
      .eq("statut", "envoyee")
      .neq("type_facture", TYPE_AVOIR)
      .order("date_emission", { ascending: false }),
    idsParentsVentiles(),
  ]);
  type Row = {
    id: string;
    numero: string;
    date_emission: string;
    total_ht: number;
    client: { nom: string } | null;
    paiements: Array<{ date_paiement: string; montant: number }> | null;
  };
  const rows = ((factures ?? []) as unknown as Row[]).filter((f) => !parentsVentiles.has(f.id));
  if (rows.length === 0) return [];

  const { data: avoirs } = await supabase
    .from("factures")
    .select("facture_parent_id, total_ht, mode_avoir")
    .in("facture_parent_id", rows.map((f) => f.id))
    .eq("type_facture", TYPE_AVOIR)
    .in("statut", ["envoyee", "payee"]);
  const imputes = new Map<string, number>();
  for (const a of avoirs ?? []) {
    if (a.mode_avoir === "remboursement" || !a.facture_parent_id) continue;
    imputes.set(a.facture_parent_id, (imputes.get(a.facture_parent_id) ?? 0) + Number(a.total_ht));
  }

  return rows
    .map((f) => {
      const paiements = (f.paiements ?? []).map((p) => ({ date_paiement: p.date_paiement, montant: Number(p.montant) }));
      const encaisse = paiements.reduce((s, p) => s + p.montant, 0);
      return {
        id: f.id,
        numero: f.numero,
        client_nom: f.client?.nom ?? null,
        date_emission: f.date_emission,
        reste_du: montantRestant(Number(f.total_ht), encaisse + (imputes.get(f.id) ?? 0)),
        paiements,
      };
    })
    .filter((f) => f.reste_du > 0);
}

export type PaiementRapproche = {
  factureId: string;
  date_paiement: string;
  montant: number;
  reference: string;
};

/**
 * Enregistre les paiements validés par l'utilisateur, un par un, avec
 * les mêmes gardes que la saisie manuelle (reste dû, statut). Une
 * erreur sur l'un n'empêche pas les autres ; le détail est renvoyé.
 */
export async function enregistrerPaiementsRapprochesAction(
  items: PaiementRapproche[],
): Promise<{ enregistres: number; erreurs: string[] }> {
  let enregistres = 0;
  const erreurs: string[] = [];
  for (const item of items.slice(0, 200)) {
    const res = await addPaiementAction(item.factureId, {
      date_paiement: item.date_paiement,
      montant: item.montant,
      mode: "virement",
      reference: item.reference.slice(0, 120),
      notes: "Rapprochement bancaire",
    });
    if (res.ok) enregistres++;
    else erreurs.push(`${item.reference.slice(0, 40)} : ${res.error}`);
  }
  return { enregistres, erreurs };
}
