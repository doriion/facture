"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { figerEmetteurDocument } from "@/lib/actions/emetteur-helpers";
import { parseMoneyInput } from "@/lib/format";
import { estFactureVentilee, paiementAutorise } from "@/lib/factures-transitions";
import {
  montantRestant,
  statutApresEncaissement,
  statutApresSuppressionPaiement,
} from "@/lib/paiements-helpers";
import {
  MODES_PAIEMENT,
  type ModePaiement,
  type FacturePaiementsSummary,
} from "@/lib/paiements-constants";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Liste les paiements d'une facture + résumé encaissé/reste.
 */
export async function getFacturePaiements(
  factureId: string,
): Promise<FacturePaiementsSummary> {
  const supabase = createClient();
  const [factureRes, paiementsRes] = await Promise.all([
    supabase
      .from("factures")
      .select("total_ht, statut, type_facture")
      .eq("id", factureId)
      .maybeSingle(),
    supabase
      .from("paiements")
      .select("*")
      .eq("facture_id", factureId)
      .order("date_paiement", { ascending: true }),
  ]);

  // Une lecture en échec ne doit JAMAIS valoir « total 0 » : le reste dû
  // serait nul et la facture passerait « payée » sans encaissement.
  if (factureRes.error) throw new Error(factureRes.error.message);
  if (!factureRes.data) throw new Error("Facture introuvable.");
  if (paiementsRes.error) throw new Error(paiementsRes.error.message);
  const total_facture = Number(factureRes.data.total_ht);
  const paiements = (paiementsRes.data ?? []).map((p) => ({
    id: p.id,
    facture_id: p.facture_id,
    date_paiement: p.date_paiement,
    montant: Number(p.montant),
    mode: p.mode,
    reference: p.reference,
    notes: p.notes,
  }));
  const total_encaisse = paiements.reduce((s, p) => s + p.montant, 0);
  const reste_du = montantRestant(total_facture, total_encaisse);

  return {
    total_facture,
    total_encaisse,
    reste_du,
    paiements,
    statut: factureRes.data.statut,
    type_facture: factureRes.data.type_facture,
  };
}

export async function addPaiementAction(
  factureId: string,
  raw: {
    date_paiement: string;
    montant: string | number;
    mode: string;
    reference?: string;
    notes?: string;
  },
): Promise<ActionResult<{ id: string }>> {
  const montant = parseMoneyInput(raw.montant);
  if (!Number.isFinite(montant) || montant <= 0) {
    return { ok: false, error: "Montant invalide." };
  }
  if (!raw.date_paiement) {
    return { ok: false, error: "Date obligatoire." };
  }
  if (!MODES_PAIEMENT.includes(raw.mode as ModePaiement)) {
    return { ok: false, error: "Mode de paiement invalide." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  // Gardes métier (lib/factures-transitions) : facture existante, ni
  // annulée ni ventilée en acomptes/solde, montant ≤ reste dû.
  let resume: FacturePaiementsSummary;
  try {
    resume = await getFacturePaiements(factureId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Facture introuvable." };
  }
  const { data: enfants } = await supabase
    .from("factures")
    .select("statut")
    .eq("facture_parent_id", factureId);
  const garde = paiementAutorise(resume.statut, {
    ventilee: estFactureVentilee({ type_facture: resume.type_facture }, enfants ?? []),
    resteDu: resume.reste_du,
    montant,
  });
  if (!garde.ok) return garde;

  const { data, error } = await supabase
    .from("paiements")
    .insert({
      user_id: user.id,
      facture_id: factureId,
      date_paiement: raw.date_paiement,
      montant,
      mode: raw.mode,
      reference: raw.reference?.trim() || null,
      notes: raw.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur." };
  }

  // Si reste à devoir = 0 → passe automatiquement la facture en "payee"
  await maybeMarkFacturePaid(factureId);

  revalidatePath(`/factures/${factureId}`);
  revalidatePath("/factures");
  revalidatePath("/dashboard");
  revalidatePath("/exports");
  return { ok: true, data: { id: data.id } };
}

export async function deletePaiementAction(
  paiementId: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: p } = await supabase
    .from("paiements")
    .select("facture_id")
    .eq("id", paiementId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Paiement introuvable." };

  const { error } = await supabase
    .from("paiements")
    .delete()
    .eq("id", paiementId);
  if (error) return { ok: false, error: error.message };

  // Si la facture était « payée » et que le reste dû redevient positif
  // après suppression, elle repasse « envoyée » (logique testée dans
  // lib/paiements-helpers).
  const { data: facture } = await supabase
    .from("factures")
    .select("statut")
    .eq("id", p.facture_id)
    .maybeSingle();
  if (facture) {
    let summary: FacturePaiementsSummary;
    try {
      summary = await getFacturePaiements(p.facture_id);
    } catch {
      revalidatePath(`/factures/${p.facture_id}`);
      return { ok: true, data: undefined };
    }
    const nouveau = statutApresSuppressionPaiement(
      facture.statut,
      summary.reste_du,
    );
    if (nouveau !== facture.statut) {
      await supabase
        .from("factures")
        .update({ statut: nouveau })
        .eq("id", p.facture_id);
    }
  }

  revalidatePath(`/factures/${p.facture_id}`);
  revalidatePath("/factures");
  revalidatePath("/dashboard");
  revalidatePath("/exports");
  return { ok: true, data: undefined };
}

/**
 * Repasse une facture « payée » en « envoyée », en proposant de
 * supprimer les paiements enregistrés (flux inverse de « Marquer
 * payée » : sans cette suppression, le CA encaissé — jauges, export
 * URSSAF — continuerait de compter des paiements d'une facture
 * redevenue impayée).
 */
export async function repasserEnvoyeeAction(
  factureId: string,
  supprimerPaiements: boolean,
): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: facture } = await supabase
    .from("factures")
    .select("statut")
    .eq("id", factureId)
    .maybeSingle();
  if (!facture) return { ok: false, error: "Facture introuvable." };
  if (facture.statut !== "payee") {
    return {
      ok: false,
      error: "Seule une facture payée peut être repassée en envoyée.",
    };
  }

  if (supprimerPaiements) {
    const { error: delErr } = await supabase
      .from("paiements")
      .delete()
      .eq("facture_id", factureId);
    if (delErr) return { ok: false, error: delErr.message };
  }

  const { error } = await supabase
    .from("factures")
    .update({ statut: "envoyee" })
    .eq("id", factureId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/factures/${factureId}`);
  revalidatePath("/factures");
  revalidatePath("/dashboard");
  revalidatePath("/exports");
  return { ok: true, data: undefined };
}

async function maybeMarkFacturePaid(factureId: string) {
  let summary: FacturePaiementsSummary;
  try {
    summary = await getFacturePaiements(factureId);
  } catch {
    // Lecture impossible : on ne touche pas au statut (jamais « payée »
    // sur une donnée manquante).
    return;
  }
  const supabase = createClient();
  const { data: facture } = await supabase
    .from("factures")
    .select("statut")
    .eq("id", factureId)
    .maybeSingle();
  if (!facture) return;
  // Statut dérivé des encaissements (logique testée dans lib/paiements-helpers)
  const nouveau = statutApresEncaissement(facture.statut, summary.reste_du);
  if (nouveau !== facture.statut) {
    await supabase
      .from("factures")
      .update({ statut: nouveau })
      .eq("id", factureId);
  }
  // Une facture qui reçoit un paiement est de fait émise : mentions
  // émetteur figées (couvre le passage direct brouillon → payée).
  await figerEmetteurDocument(supabase, "factures", factureId);
}
