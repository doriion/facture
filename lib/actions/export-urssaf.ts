"use server";

import { createClient } from "@/lib/supabase/server";
import { VENTILATION_VIDE } from "@/lib/fiscal";
import {
  summarizeEncaissements,
  totalFacturesEmises,
  type ExportSummary,
  type PaiementExportInput,
} from "@/lib/exports/urssaf-helpers";

// Ce fichier "use server" n'expose QUE la server action async
// buildExportUrssaf. Les types et les helpers sync (getExportPeriodes,
// buildCsv, summarizeEncaissements…) sont dans
// lib/exports/urssaf-helpers.ts et doivent y être importés directement.

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
      ventilation: { ...VENTILATION_VIDE },
      total_facture_emis: 0,
      nb_factures: 0,
      rows: [],
    };
  }

  // Paiements de la période (date_paiement >= start, < end), avec les
  // infos facture/client jointes + les lignes (nature fiscale) pour
  // ventiler chaque encaissement dans les 3 cases URSSAF au prorata.
  const { data: paiements } = await supabase
    .from("paiements")
    .select(
      "id, date_paiement, montant, mode, reference, facture:factures(id, numero, date_emission, total_ht, type_activite, statut, client:clients(nom), lignes:factures_lignes(total_ht, nature_fiscale))",
    )
    .gte("date_paiement", start)
    .lt("date_paiement", end)
    .order("date_paiement", { ascending: true });

  const { rows, total_encaisse, ventilation, nb_factures } = summarizeEncaissements(
    (paiements ?? []) as unknown as PaiementExportInput[],
  );

  // Factures émises sur la période (info complémentaire, hors annulées)
  const { data: facturesEmises } = await supabase
    .from("factures")
    .select("total_ht")
    .gte("date_emission", start)
    .lt("date_emission", end)
    .neq("statut", "annulee");

  return {
    periode: { label: "", start, end },
    total_encaisse,
    ventilation,
    total_facture_emis: totalFacturesEmises(facturesEmises ?? []),
    nb_factures,
    rows,
  };
}
