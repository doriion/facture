"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { parseMoneyInput } from "@/lib/format";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const MODES_PAIEMENT = [
  "virement",
  "cheque",
  "especes",
  "carte",
  "lien_paiement",
  "autre",
] as const;
export type ModePaiement = (typeof MODES_PAIEMENT)[number];

export const LABELS_MODE_PAIEMENT: Record<ModePaiement, string> = {
  virement: "Virement",
  cheque: "Chèque",
  especes: "Espèces",
  carte: "Carte bancaire",
  lien_paiement: "Lien de paiement",
  autre: "Autre",
};

export type Paiement = {
  id: string;
  facture_id: string;
  date_paiement: string;
  montant: number;
  mode: string;
  reference: string | null;
  notes: string | null;
};

export type FacturePaiementsSummary = {
  total_facture: number;
  total_encaisse: number;
  reste_du: number;
  paiements: Paiement[];
};

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
      .select("total_ht")
      .eq("id", factureId)
      .maybeSingle(),
    supabase
      .from("paiements")
      .select("*")
      .eq("facture_id", factureId)
      .order("date_paiement", { ascending: true }),
  ]);

  const total_facture = Number(factureRes.data?.total_ht ?? 0);
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
  const reste_du = Math.max(0, total_facture - total_encaisse);

  return { total_facture, total_encaisse, reste_du, paiements };
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

  // Si la facture était passée auto à "payee" et qu'on retire un paiement,
  // on la repasse à "envoyee" (resp. on laisse en "payee" si pas auto).
  // Heuristique simple : si reste_du > 0 et statut = "payee", on repasse
  // en "envoyee".
  const { data: facture } = await supabase
    .from("factures")
    .select("statut")
    .eq("id", p.facture_id)
    .maybeSingle();
  if (facture?.statut === "payee") {
    const summary = await getFacturePaiements(p.facture_id);
    if (summary.reste_du > 0.005) {
      await supabase
        .from("factures")
        .update({ statut: "envoyee" })
        .eq("id", p.facture_id);
    }
  }

  revalidatePath(`/factures/${p.facture_id}`);
  revalidatePath("/factures");
  return { ok: true, data: undefined };
}

async function maybeMarkFacturePaid(factureId: string) {
  const summary = await getFacturePaiements(factureId);
  if (summary.reste_du > 0.005) return; // pas tout payé
  const supabase = createClient();
  const { data: facture } = await supabase
    .from("factures")
    .select("statut")
    .eq("id", factureId)
    .maybeSingle();
  if (!facture) return;
  if (facture.statut === "envoyee" || facture.statut === "brouillon") {
    await supabase
      .from("factures")
      .update({ statut: "payee" })
      .eq("id", factureId);
  }
}
