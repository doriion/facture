"use server";

import { createClient } from "@/lib/supabase/server";
import { idsParentsVentiles } from "@/lib/actions/factures";
import { VENTILATION_VIDE } from "@/lib/fiscal";
import {
  summarizeEncaissements,
  totalEncaissePeriode,
  totalFacturesEmises,
  type ExportSummary,
  type PaiementEncaisse,
  type PaiementExportInput,
} from "@/lib/exports/urssaf-helpers";

// Ce fichier "use server" n'expose QUE des server actions async
// (buildExportUrssaf, totauxEncaissesUrssaf). Les types et les helpers sync (getExportPeriodes,
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
  const supabase = await createClient();

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
  // Les deux requêtes sont indépendantes : en parallèle.
  const [{ data: paiements }, { data: facturesEmises }, parentsVentiles] = await Promise.all([
    supabase
      .from("paiements")
      .select(
        "id, date_paiement, montant, mode, reference, facture:factures(id, numero, date_emission, total_ht, type_activite, statut, type_facture, client:clients(nom), lignes:factures_lignes(total_ht, nature_fiscale))",
      )
      .gte("date_paiement", start)
      .lt("date_paiement", end)
      .order("date_paiement", { ascending: true }),
    // Factures émises sur la période (info complémentaire, hors annulées)
    supabase
      .from("factures")
      .select("id, total_ht, type_facture")
      .gte("date_emission", start)
      .lt("date_emission", end)
      .neq("statut", "annulee")
      .neq("statut", "brouillon"),
    // Factures d'origine ventilées en acomptes/solde : leurs enfants
    // portent déjà le montant.
    idsParentsVentiles(),
  ]);

  const { rows, total_encaisse, ventilation, nb_factures } = summarizeEncaissements(
    (paiements ?? []) as unknown as PaiementExportInput[],
  );

  return {
    periode: { label: "", start, end },
    total_encaisse,
    ventilation,
    total_facture_emis: totalFacturesEmises(
      (facturesEmises ?? []).filter((f) => !parentsVentiles.has(f.id)),
    ),
    nb_factures,
    rows,
  };
}

/**
 * Encaissé (base URSSAF) de plusieurs périodes en UNE lecture : les
 * paiements de l'enveloppe [début le plus tôt, fin la plus tardive) sont
 * lus une fois puis répartis. Même règle que l'export
 * (totalEncaissePeriode) : le tableau de bord affiche exactement le
 * chiffre de la page Exports, sans refaire trois fois la jointure
 * paiements → factures → lignes → clients.
 */
export async function totauxEncaissesUrssaf(
  periodes: Array<{ start: string; end: string }>,
): Promise<number[]> {
  if (periodes.length === 0) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return periodes.map(() => 0);

  const debut = periodes.reduce((min, p) => (p.start < min ? p.start : min), periodes[0]!.start);
  const fin = periodes.reduce((max, p) => (p.end > max ? p.end : max), periodes[0]!.end);
  const { data } = await supabase
    .from("paiements")
    .select("date_paiement, montant, facture:factures(statut, type_facture)")
    .gte("date_paiement", debut)
    .lt("date_paiement", fin);
  const paiements = (data ?? []) as unknown as Array<PaiementEncaisse & { date_paiement: string }>;

  return periodes.map((p) =>
    totalEncaissePeriode(
      paiements.filter((x) => x.date_paiement >= p.start && x.date_paiement < p.end),
    ),
  );
}
