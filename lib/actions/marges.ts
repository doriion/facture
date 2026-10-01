"use server";

import { createClient } from "@/lib/supabase/server";
import { aujourdhuiParis } from "@/lib/dates";
import {
  margesParChantier,
  margesParMois,
  totalMarges,
  type LigneMargeFacture,
  type MargeChantier,
  type MargeMois,
} from "@/lib/marges-agregats";

export type MargesAnnee = {
  annee: number;
  chantiers: MargeChantier[];
  mois: MargeMois[];
  total: Omit<MargeMois, "mois">;
};

/**
 * Marges de l'année par chantier (facture) et par mois. INTERNE : ces
 * chiffres ne figurent sur aucun document client ni lien public.
 */
export async function getMargesAnnee(annee?: number): Promise<MargesAnnee> {
  const supabase = createClient();
  const an = annee ?? Number(aujourdhuiParis().slice(0, 4));
  const { data } = await supabase
    .from("factures_lignes")
    .select(
      "type, quantite, prix_unitaire_ht, prix_achat_ttc_unitaire, facture:factures!inner(id, numero, date_emission, statut, type_facture, total_ht, client:clients(nom))",
    )
    .gte("facture.date_emission", `${an}-01-01`)
    .lt("facture.date_emission", `${an + 1}-01-01`);

  const chantiers = margesParChantier((data ?? []) as unknown as LigneMargeFacture[]);
  const mois = margesParMois(chantiers);
  return { annee: an, chantiers, mois, total: totalMarges(mois) };
}
