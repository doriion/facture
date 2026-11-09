"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { aujourdhuiParis } from "@/lib/dates";
import { ajouterJours } from "@/lib/agenda-vues";
import { getBaremeEntretien } from "@/lib/actions/bareme-entretien";
import { createFactureAction } from "@/lib/actions/factures";
import { convertirDevisEnFactureAction } from "@/lib/actions/devis";
import { envoyerFactureParEmailAction } from "@/lib/actions/emails";
import { mapInterventionTypeToActivite } from "@/lib/facture-prefill";
import { propositionsFacturation, type LigneProposee, type PropositionFacturation } from "@/lib/cloture-intervention";
import type { PrestationCatalogue } from "@/lib/catalogue-recherche";
import type { FactureFormInput } from "@/lib/validations/facture";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Propositions de facturation d'une intervention : devis acceptés du
 * client non facturés, article du catalogue, barème d'entretien, ligne
 * libre. Calcul pur dans lib/cloture-intervention.
 */
export async function propositionsClotureAction(interventionId: string): Promise<ActionResult<{ propositions: PropositionFacturation[]; clientEmail: string | null; emailConfigure: boolean }>> {
  const supabase = await createClient();
  const { data: it } = await supabase.from("interventions").select("*, client:clients(id, email)").eq("id", interventionId).maybeSingle();
  if (!it) return { ok: false, error: "Intervention introuvable." };
  type Row = typeof it & { client: { id: string; email: string | null } | null };
  const { client, ...intervention } = it as Row;
  if (intervention.facture_id) return { ok: false, error: "Cette intervention est déjà facturée." };

  const [devisRes, produitsRes, bareme] = await Promise.all([
    client
      ? supabase.from("devis").select("id, numero, total_ht, lignes:devis_lignes(designation, quantite, prix_unitaire_ht, prix_achat_ttc_unitaire, fournisseur, nature_fiscale, type, ordre)").eq("client_id", client.id).eq("est_modele", false).eq("statut", "accepte").is("facture_id", null).order("date_emission", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("produits_services").select("id, designation, description, prix_ht, prix_achat_ttc, fournisseur, nature_fiscale, actif").eq("actif", true),
    getBaremeEntretien().catch(() => null),
  ]);
  type DevisRow = { id: string; numero: string; total_ht: number; lignes: Array<{ designation: string; quantite: number; prix_unitaire_ht: number; prix_achat_ttc_unitaire: number | null; fournisseur: string | null; nature_fiscale: string | null; type: string | null; ordre: number }> };
  const devisAcceptes = ((devisRes.data ?? []) as unknown as DevisRow[]).map((d) => ({ ...d, lignes: [...d.lignes].sort((a, b) => a.ordre - b.ordre) }));
  const propositions = propositionsFacturation({
    intervention,
    devisAcceptes,
    catalogue: (produitsRes.data ?? []) as unknown as PrestationCatalogue[],
    bareme,
  });
  const { isEmailConfigured } = await import("@/lib/email");
  return { ok: true, data: { propositions, clientEmail: client?.email ?? null, emailConfigure: isEmailConfigured() } };
}

/**
 * Facture en un tap : convertit le devis choisi, ou crée la facture
 * avec les lignes proposées (client, dates et matériel de
 * l'intervention), rattache l'intervention, et envoie par e-mail si
 * demandé. La facture reste modifiable ensuite comme n'importe quelle
 * facture (une facture envoyée se corrige par avoir).
 */
export async function facturerInterventionAction(
  interventionId: string,
  choix: { source: PropositionFacturation["source"]; devisId?: string; lignes: LigneProposee[]; envoyer: boolean },
): Promise<ActionResult<{ factureId: string; numero: string; envoyee: boolean; avertissement: string | null }>> {
  const supabase = await createClient();
  const { data: it } = await supabase.from("interventions").select("*").eq("id", interventionId).maybeSingle();
  if (!it) return { ok: false, error: "Intervention introuvable." };
  if (it.facture_id) return { ok: false, error: "Cette intervention est déjà facturée." };
  if (!it.client_id) return { ok: false, error: "Renseignez d'abord le client de l'intervention (fiche → Modifier)." };

  let factureId: string;
  let numero: string;
  if (choix.source === "devis" && choix.devisId) {
    const res = await convertirDevisEnFactureAction(choix.devisId);
    if (!res.ok) return res;
    factureId = res.data.factureId;
    numero = res.data.numero;
    await supabase.from("interventions").update({ facture_id: factureId }).eq("id", interventionId).is("facture_id", null);
  } else {
    const lignes = choix.lignes.filter((l) => l.designation.trim());
    if (lignes.length === 0) return { ok: false, error: "Aucune ligne à facturer." };
    const today = aujourdhuiParis();
    const { data: profil } = await supabase.from("profil_entreprise").select("conditions_paiement_default").maybeSingle();
    const activite = mapInterventionTypeToActivite(it.type, it.fluide_frigo_type) || "autre";
    const values: FactureFormInput = {
      client_id: it.client_id,
      type_activite: activite,
      date_emission: today,
      date_echeance: ajouterJours(today, 30),
      date_prestation: it.date_intervention,
      date_prestation_fin: it.date_fin && it.date_fin !== it.date_intervention ? it.date_fin : "",
      conditions_paiement: profil?.conditions_paiement_default ?? "",
      adresse_chantier: "",
      notes: "",
      exclure_relances_auto: false,
      lignes: lignes.map((l) => ({
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        prix_achat_ttc_unitaire: l.prix_achat_ttc_unitaire,
        fournisseur: l.fournisseur,
        nature_fiscale: l.nature_fiscale as FactureFormInput["lignes"][number]["nature_fiscale"],
        type: l.type,
      })),
      equipement: {
        marque: it.equipement_marque ?? "",
        modele: it.equipement_modele ?? "",
        num_serie: it.equipement_num_serie ?? "",
        fluide_frigo_type: it.fluide_frigo_type ?? "",
        fluide_frigo_kg: it.fluide_charge_totale_kg !== null ? Number(it.fluide_charge_totale_kg) : null,
      },
      aides_financieres: { maprimerenov: null, cee: null, eco_ptz: null },
    };
    const res = await createFactureAction(values as never, { interventionId });
    if (!res.ok) return res;
    factureId = res.data.id;
    numero = res.data.numero;
  }

  let envoyee = false;
  let avertissement: string | null = null;
  if (choix.envoyer) {
    const envoi = await envoyerFactureParEmailAction(factureId);
    if (envoi.ok) envoyee = true;
    else avertissement = `Facture ${numero} créée mais non envoyée : ${envoi.error}`;
  }
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath(`/interventions/${interventionId}`);
  return { ok: true, data: { factureId, numero, envoyee, avertissement } };
}

/** Rien à facturer, ou facturé par le donneur d'ordre : l'intervention sort de la liste « à facturer ». */
export async function clotureSansFactureAction(interventionId: string, motif: "rien" | "donneur_ordre"): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: it } = await supabase.from("interventions").select("id, notes, facture_id").eq("id", interventionId).maybeSingle();
  if (!it) return { ok: false, error: "Intervention introuvable." };
  if (it.facture_id) return { ok: false, error: "Cette intervention est déjà facturée." };
  const mention = motif === "donneur_ordre" ? "Facturé par le donneur d'ordre." : null;
  const notes = mention && !(it.notes ?? "").includes(mention) ? [it.notes?.trim(), mention].filter(Boolean).join("\n") : it.notes;
  const { error } = await supabase.from("interventions").update({ a_facturer: false, notes }).eq("id", interventionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath(`/interventions/${interventionId}`);
  return { ok: true, data: undefined };
}
