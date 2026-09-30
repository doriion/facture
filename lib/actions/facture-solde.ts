import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { SoldeDetail } from "@/components/factures/facture-pdf";

type AnyClient = SupabaseClient<Database>;

/**
 * Facture de solde : total des travaux (facture d'origine) et acomptes
 * déjà facturés, pour que le document remis au client explique d'où
 * vient le montant. null pour tout autre type de facture.
 */
export async function detailSolde(
  client: AnyClient,
  facture: { type_facture?: string | null; facture_parent_id?: string | null },
): Promise<SoldeDetail | null> {
  if (facture.type_facture !== "solde" || !facture.facture_parent_id) return null;
  const [{ data: parent }, { data: acomptes }] = await Promise.all([
    client
      .from("factures")
      .select("total_ht")
      .eq("id", facture.facture_parent_id)
      .maybeSingle(),
    client
      .from("factures")
      .select("numero, date_emission, total_ht")
      .eq("facture_parent_id", facture.facture_parent_id)
      .eq("type_facture", "acompte")
      .neq("statut", "annulee")
      .order("date_emission", { ascending: true }),
  ]);
  if (!parent) return null;
  return {
    totalTravaux: Number(parent.total_ht),
    acomptes: (acomptes ?? []).map((a) => ({
      numero: a.numero,
      date_emission: a.date_emission,
      montant: Number(a.total_ht),
    })),
  };
}
