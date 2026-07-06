"use server";

import { createClient } from "@/lib/supabase/server";
import { estEnRetard, joursDeRetard } from "@/lib/relances-helpers";

export type FactureEnRetard = {
  id: string;
  numero: string;
  date_echeance: string;
  total_ht: number;
  client_nom: string | null;
  client_email: string | null;
  joursRetard: number;
  /** ISO datetime de la dernière relance envoyée, null si jamais relancée */
  derniereRelance: string | null;
  nbRelances: number;
};

export type FacturesEnRetardData = {
  factures: FactureEnRetard[];
  /**
   * False si la table `relances` n'existe pas encore (migration non
   * appliquée) : la liste fonctionne quand même, sans l'historique.
   */
  tracageDisponible: boolean;
};

/**
 * Liste les factures impayées en retard (statut "envoyée" + échéance
 * strictement dépassée), avec le nombre de jours de retard et
 * l'historique des relances envoyées.
 */
export async function getFacturesEnRetard(): Promise<FacturesEnRetardData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { factures: [], tracageDisponible: true };

  const today = new Date().toISOString().slice(0, 10);

  const { data: factures } = await supabase
    .from("factures")
    .select("id, numero, date_echeance, total_ht, statut, client:clients(nom, email)")
    .eq("statut", "envoyee")
    .lt("date_echeance", today)
    .order("date_echeance", { ascending: true });

  type Row = {
    id: string;
    numero: string;
    date_echeance: string;
    total_ht: number;
    statut: string;
    client: { nom: string; email: string | null } | null;
  };
  const rows = ((factures ?? []) as Row[]).filter((f) =>
    estEnRetard(f.statut, f.date_echeance, today),
  );

  // Historique des relances (best-effort : la table peut ne pas encore
  // exister si la migration n'a pas été appliquée).
  const relancesParFacture = new Map<
    string,
    { derniere: string; nb: number }
  >();
  let tracageDisponible = true;
  if (rows.length > 0) {
    const { data: relances, error } = await supabase
      .from("relances")
      .select("facture_id, envoyee_le")
      .in(
        "facture_id",
        rows.map((f) => f.id),
      )
      .order("envoyee_le", { ascending: false });
    if (error) {
      tracageDisponible = false;
    } else {
      for (const r of relances ?? []) {
        const existing = relancesParFacture.get(r.facture_id);
        if (existing) {
          existing.nb += 1;
        } else {
          // Première rencontrée = la plus récente (tri desc)
          relancesParFacture.set(r.facture_id, {
            derniere: r.envoyee_le,
            nb: 1,
          });
        }
      }
    }
  }

  return {
    factures: rows.map((f) => ({
      id: f.id,
      numero: f.numero,
      date_echeance: f.date_echeance,
      total_ht: Number(f.total_ht),
      client_nom: f.client?.nom ?? null,
      client_email: f.client?.email ?? null,
      joursRetard: joursDeRetard(f.date_echeance, today),
      derniereRelance: relancesParFacture.get(f.id)?.derniere ?? null,
      nbRelances: relancesParFacture.get(f.id)?.nb ?? 0,
    })),
    tracageDisponible,
  };
}
