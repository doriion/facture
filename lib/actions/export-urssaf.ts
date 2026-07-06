"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  ExportRow,
  ExportSummary,
} from "@/lib/exports/urssaf-helpers";

// Ce fichier "use server" n'expose QUE la server action async
// buildExportUrssaf. Les types et les helpers sync (getExportPeriodes,
// buildCsv…) sont dans lib/exports/urssaf-helpers.ts et doivent y être
// importés directement.

/**
 * Calcule la base URSSAF d'une période : somme des paiements encaissés
 * (et non des factures émises — important pour la micro-entreprise).
 *
 * Renvoie un tableau de lignes prêt pour CSV + un total.
 */
export async function buildExportUrssaf(
  start: string,
  end: string,
): Promise<ExportSummary> {
  const supabase = createClient();

  // Garde d'auth explicite : la RLS protège déjà les données (requêtes
  // vides si non connecté), mais on court-circuite proprement plutôt
  // que de renvoyer un export silencieusement vide.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      periode: { label: "", start, end },
      total_encaisse: 0,
      total_facture_emis: 0,
      nb_factures: 0,
      rows: [],
    };
  }

  // Paiements de la période (date_paiement >= start, < end), avec
  // les infos facture/client jointes.
  const { data: paiements } = await supabase
    .from("paiements")
    .select(
      "id, date_paiement, montant, mode, reference, facture:factures(id, numero, date_emission, total_ht, type_activite, statut, client:clients(nom))",
    )
    .gte("date_paiement", start)
    .lt("date_paiement", end)
    .order("date_paiement", { ascending: true });

  type Row = {
    id: string;
    date_paiement: string;
    montant: number;
    mode: string;
    reference: string | null;
    facture: {
      id: string;
      numero: string;
      date_emission: string;
      total_ht: number;
      type_activite: string;
      statut: string;
      client: { nom: string } | null;
    } | null;
  };

  const facturesAffected = new Set<string>();
  const rows: ExportRow[] = [];
  let totalEncaisse = 0;

  for (const p of (paiements ?? []) as Row[]) {
    if (!p.facture) continue;
    if (p.facture.statut === "annulee") continue;
    facturesAffected.add(p.facture.id);
    totalEncaisse += Number(p.montant);
    rows.push({
      numero_facture: p.facture.numero,
      date_facture: p.facture.date_emission,
      client: p.facture.client?.nom ?? "(client supprimé)",
      type_activite: p.facture.type_activite,
      total_facture: Number(p.facture.total_ht),
      date_encaissement: p.date_paiement,
      mode_paiement: p.mode,
      reference_paiement: p.reference,
      montant_encaisse: Number(p.montant),
    });
  }

  // Factures émises sur la période (info complémentaire, hors annulées)
  const { data: facturesEmises } = await supabase
    .from("factures")
    .select("total_ht")
    .gte("date_emission", start)
    .lt("date_emission", end)
    .neq("statut", "annulee");
  const totalFactureEmis = (facturesEmises ?? []).reduce(
    (s, f) => s + Number(f.total_ht),
    0,
  );

  return {
    periode: { label: "", start, end },
    total_encaisse: Math.round(totalEncaisse * 100) / 100,
    total_facture_emis: Math.round(totalFactureEmis * 100) / 100,
    nb_factures: facturesAffected.size,
    rows,
  };
}
