"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { completerPrixAchatCatalogue } from "@/lib/catalogue-sync";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export type LigneCible = {
  id: string;
  designation: string;
  quantite: number;
  prix_achat_ttc_unitaire: number | null;
  fournisseur: string | null;
};

export type DocumentCible = {
  type: "devis" | "facture";
  id: string;
  numero: string;
  date: string;
  client: string;
  lignes: LigneCible[];
};

export type ArticleCible = {
  id: string;
  designation: string;
  prix_achat_ttc: number | null;
  fournisseur: string | null;
};

export type CiblesCouts = { documents: DocumentCible[]; articles: ArticleCible[] };

const LIMITE_DOCUMENTS = 25;

/**
 * Où rattacher les achats d'une facture fournisseur : les devis et
 * factures récents (lignes « ligne » seulement, les titres ne portent pas
 * de coût) et les articles du catalogue. INTERNE : les prix d'achat ne
 * sortent jamais vers le client.
 */
export async function ciblesCoutsAction(): Promise<ActionResult<CiblesCouts>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const [devis, factures, articles] = await Promise.all([
    supabase
      .from("devis")
      .select("id, numero, date_emission, client:clients(nom), lignes:devis_lignes(id, designation, quantite, prix_achat_ttc_unitaire, fournisseur, type, ordre)")
      .eq("est_modele", false)
      .neq("statut", "refuse")
      .order("date_emission", { ascending: false })
      .limit(LIMITE_DOCUMENTS),
    supabase
      .from("factures")
      .select("id, numero, date_emission, client:clients(nom), lignes:factures_lignes(id, designation, quantite, prix_achat_ttc_unitaire, fournisseur, type, ordre)")
      .neq("statut", "annulee")
      .order("date_emission", { ascending: false })
      .limit(LIMITE_DOCUMENTS),
    supabase.from("produits_services").select("id, designation, prix_achat_ttc, fournisseur").eq("actif", true).order("designation"),
  ]);

  type BrutDoc = {
    id: string;
    numero: string;
    date_emission: string;
    client: { nom: string } | { nom: string }[] | null;
    lignes: Array<{ id: string; designation: string; quantite: number; prix_achat_ttc_unitaire: number | null; fournisseur: string | null; type: string; ordre: number }>;
  };
  const versDocument = (type: DocumentCible["type"]) => (d: BrutDoc): DocumentCible => {
    const client = Array.isArray(d.client) ? d.client[0] : d.client;
    return {
      type,
      id: d.id,
      numero: d.numero,
      date: d.date_emission,
      client: client?.nom ?? "",
      lignes: (d.lignes ?? [])
        .filter((l) => (l.type ?? "ligne") === "ligne")
        .sort((a, b) => a.ordre - b.ordre)
        .map((l) => ({
          id: l.id,
          designation: l.designation,
          quantite: Number(l.quantite),
          prix_achat_ttc_unitaire: l.prix_achat_ttc_unitaire === null ? null : Number(l.prix_achat_ttc_unitaire),
          fournisseur: l.fournisseur,
        })),
    };
  };

  const documents = [
    ...((factures.data ?? []) as unknown as BrutDoc[]).map(versDocument("facture")),
    ...((devis.data ?? []) as unknown as BrutDoc[]).map(versDocument("devis")),
  ]
    .filter((d) => d.lignes.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    ok: true,
    data: {
      documents,
      articles: (articles.data ?? []).map((a) => ({
        id: a.id,
        designation: a.designation,
        prix_achat_ttc: a.prix_achat_ttc === null ? null : Number(a.prix_achat_ttc),
        fournisseur: a.fournisseur,
      })),
    },
  };
}

const cibleSchema = z.object({
  type: z.enum(["devis", "facture", "produit"]),
  id: z.string().uuid(),
  prixAchatUnitaire: z.number().min(0).max(1_000_000),
});

const appliquerSchema = z.object({
  fournisseur: z.string().trim().max(120).nullable(),
  cibles: z.array(cibleSchema).min(1, "Aucune ligne à renseigner.").max(200),
});

export type AppliquerCoutsInput = z.input<typeof appliquerSchema>;

/**
 * Renseigne les prix d'achat lus sur la facture fournisseur : sur les
 * lignes de devis / facture choisies (champs PRIVÉS, jamais rendus au
 * client) et/ou sur des articles du catalogue. Les lignes de document
 * renseignées complètent aussi le catalogue (articles sans prix d'achat
 * de même désignation). Une ligne en échec n'empêche pas les autres.
 */
export async function appliquerCoutsAction(input: AppliquerCoutsInput): Promise<ActionResult<{ lignes: number; articles: number; catalogue: number; echecs: number }>> {
  const parsed = appliquerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const fournisseur = v.fournisseur?.trim() || null;
  let lignes = 0;
  let articles = 0;
  let echecs = 0;
  const pourCatalogue: Array<{ designation: string; prix_achat_ttc_unitaire: number }> = [];
  const chemins = new Set<string>(["/marges", "/produits"]);

  for (const c of v.cibles) {
    const prix = Math.round(c.prixAchatUnitaire * 100) / 100;
    if (c.type === "produit") {
      const { error } = await supabase
        .from("produits_services")
        .update({ prix_achat_ttc: prix, ...(fournisseur ? { fournisseur } : {}) })
        .eq("id", c.id)
        .eq("user_id", user.id);
      if (error) echecs += 1;
      else articles += 1;
      continue;
    }
    const table = c.type === "devis" ? "devis_lignes" : "factures_lignes";
    const { data, error } = await supabase
      .from(table)
      .update({ prix_achat_ttc_unitaire: prix, ...(fournisseur ? { fournisseur } : {}) })
      .eq("id", c.id)
      .eq("user_id", user.id)
      .select(c.type === "devis" ? "designation, devis_id" : "designation, facture_id")
      .maybeSingle();
    if (error || !data) {
      echecs += 1;
      continue;
    }
    lignes += 1;
    const ligne = data as unknown as { designation: string; devis_id?: string; facture_id?: string };
    pourCatalogue.push({ designation: ligne.designation, prix_achat_ttc_unitaire: prix });
    chemins.add(c.type === "devis" ? `/devis/${ligne.devis_id}` : `/factures/${ligne.facture_id}`);
  }

  let catalogue = 0;
  if (pourCatalogue.length > 0) {
    try {
      catalogue = await completerPrixAchatCatalogue(supabase, pourCatalogue);
    } catch {
      catalogue = 0;
    }
  }

  for (const chemin of chemins) revalidatePath(chemin);
  if (lignes + articles === 0) return { ok: false, error: "Aucune ligne n'a pu être renseignée." };
  return { ok: true, data: { lignes, articles, catalogue, echecs } };
}
