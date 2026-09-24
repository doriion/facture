"use server";

import { createClient } from "@/lib/supabase/server";
import { aujourdhuiParis } from "@/lib/dates";
import { statutAffichageFacture } from "@/lib/factures-transitions";
import { formatDateFr, formatEuros } from "@/lib/format";
import { LABELS_STATUT_DEVIS, LABELS_STATUT_FACTURE } from "@/lib/legal-text";
import { motifIlike } from "@/lib/postgrest";
import { normaliserRequete, type GroupeRecherche } from "@/lib/recherche-helpers";
import { statutAffichageDevis } from "@/lib/validations/devis";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";

type ResultatAction<T> = { ok: true; data: T } | { ok: false; error: string };

/** Résultats par groupe : assez pour retrouver, pas une liste. */
const LIMITE = 5;

/**
 * Recherche globale (Ctrl/⌘ K) : clients, factures, devis,
 * interventions, contrats, entretiens, tâches — en une saisie, depuis
 * n'importe quel écran. Recherche littérale (motifIlike), sept requêtes
 * en parallèle, RLS. Aucun coût d'achat ni prix privé dans les
 * résultats.
 */
export async function rechercheGlobaleAction(
  saisie: string,
): Promise<ResultatAction<{ groupes: GroupeRecherche[] }>> {
  const requete = normaliserRequete(saisie);
  if (!requete) return { ok: true, data: { groupes: [] } };
  const s = motifIlike(requete);
  const supabase = createClient();
  const today = aujourdhuiParis();

  const [clients, factures, devis, interventions, contrats, entretiens, taches] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, nom, raison_sociale, ville, telephone")
        .or(
          `nom.ilike.${s},raison_sociale.ilike.${s},ville.ilike.${s},email.ilike.${s},telephone.ilike.${s},adresse_ligne1.ilike.${s}`,
        )
        .order("nom")
        .limit(LIMITE),
      supabase
        .from("factures")
        .select("id, numero, statut, type_facture, mode_avoir, date_echeance, total_ht, client:clients(nom)")
        .or(`numero.ilike.${s},notes.ilike.${s},adresse_chantier.ilike.${s}`)
        .order("date_emission", { ascending: false })
        .limit(LIMITE),
      supabase
        .from("devis")
        .select("id, numero, statut, date_validite, total_ht, client:clients(nom)")
        .eq("est_modele", false)
        .or(`numero.ilike.${s},notes.ilike.${s},adresse_chantier.ilike.${s}`)
        .order("date_emission", { ascending: false })
        .limit(LIMITE),
      supabase
        .from("interventions")
        .select("id, date_intervention, type, description, client:clients(nom)")
        .is("supprime_le", null)
        .or(
          `description.ilike.${s},equipement_marque.ilike.${s},equipement_modele.ilike.${s},equipement_num_serie.ilike.${s}`,
        )
        .order("date_intervention", { ascending: false })
        .limit(LIMITE),
      supabase
        .from("contrats")
        .select("id, numero, statut, client:clients(nom)")
        .or(`numero.ilike.${s}`)
        .order("created_at", { ascending: false })
        .limit(LIMITE),
      supabase
        .from("contrats_maintenance")
        .select("id, intitule, equipement, prochaine_visite, client:clients(nom)")
        .or(`intitule.ilike.${s},equipement.ilike.${s},equipement_num_serie.ilike.${s}`)
        .order("prochaine_visite", { ascending: true, nullsFirst: false })
        .limit(LIMITE),
      supabase
        .from("taches")
        .select("id, titre, date_echeance, fait")
        .or(`titre.ilike.${s},notes.ilike.${s}`)
        .order("fait", { ascending: true })
        .order("date_echeance", { ascending: true, nullsFirst: false })
        .limit(LIMITE),
    ]);

  const erreur = [clients, factures, devis, interventions, contrats, entretiens, taches].find(
    (r) => r.error,
  )?.error;
  if (erreur) return { ok: false, error: erreur.message };

  type AvecClient = { client: { nom: string } | null };
  const nomClient = (r: AvecClient) => r.client?.nom ?? null;

  const groupes: GroupeRecherche[] = [
    {
      cle: "clients",
      libelle: "Clients",
      resultats: (clients.data ?? []).map((c) => ({
        id: c.id,
        href: `/clients/${c.id}`,
        titre: c.raison_sociale ? `${c.raison_sociale} — ${c.nom}` : c.nom,
        sousTitre: [c.ville, c.telephone].filter(Boolean).join(" · ") || null,
      })),
    },
    {
      cle: "factures",
      libelle: "Factures et avoirs",
      resultats: ((factures.data ?? []) as Array<{
        id: string;
        numero: string;
        statut: string;
        type_facture: string;
        mode_avoir: string | null;
        date_echeance: string;
        total_ht: number;
        client: { nom: string } | null;
      }>).map((f) => {
        const statut = statutAffichageFacture(f, today);
        return {
          id: f.id,
          href: `/factures/${f.id}`,
          titre: f.numero,
          sousTitre: [nomClient(f), formatEuros(Number(f.total_ht))].filter(Boolean).join(" · "),
          etiquette:
            LABELS_STATUT_FACTURE[statut as keyof typeof LABELS_STATUT_FACTURE] ?? statut,
        };
      }),
    },
    {
      cle: "devis",
      libelle: "Devis",
      resultats: ((devis.data ?? []) as Array<{
        id: string;
        numero: string;
        statut: string;
        date_validite: string;
        total_ht: number;
        client: { nom: string } | null;
      }>).map((d) => {
        const statut = statutAffichageDevis(d.statut, d.date_validite);
        return {
          id: d.id,
          href: `/devis/${d.id}`,
          titre: d.numero,
          sousTitre: [nomClient(d), formatEuros(Number(d.total_ht))].filter(Boolean).join(" · "),
          etiquette: LABELS_STATUT_DEVIS[statut as keyof typeof LABELS_STATUT_DEVIS] ?? statut,
        };
      }),
    },
    {
      cle: "interventions",
      libelle: "Interventions",
      resultats: ((interventions.data ?? []) as Array<{
        id: string;
        date_intervention: string;
        type: string;
        description: string | null;
        client: { nom: string } | null;
      }>).map((i) => ({
        id: i.id,
        href: `/interventions/${i.id}`,
        titre: `${
          LABELS_TYPE_INTERVENTION[i.type as keyof typeof LABELS_TYPE_INTERVENTION] ?? i.type
        } du ${formatDateFr(i.date_intervention)}`,
        sousTitre: [nomClient(i), i.description?.slice(0, 80)].filter(Boolean).join(" · ") || null,
      })),
    },
    {
      cle: "contrats",
      libelle: "Contrats d'entretien",
      resultats: ((contrats.data ?? []) as Array<{
        id: string;
        numero: string | null;
        statut: string;
        client: { nom: string } | null;
      }>).map((c) => ({
        id: c.id,
        href: `/contrats/${c.id}`,
        titre: c.numero ? `Contrat ${c.numero}` : "Contrat",
        sousTitre: nomClient(c),
        etiquette: c.statut,
      })),
    },
    {
      cle: "entretiens",
      libelle: "Échéancier des visites",
      resultats: ((entretiens.data ?? []) as Array<{
        id: string;
        intitule: string | null;
        equipement: string | null;
        prochaine_visite: string | null;
        client: { nom: string } | null;
      }>).map((e) => ({
        id: e.id,
        href: `/maintenance/${e.id}`,
        titre: e.intitule || e.equipement || "Entretien",
        sousTitre: nomClient(e),
        etiquette: e.prochaine_visite ? `Visite ${formatDateFr(e.prochaine_visite)}` : null,
      })),
    },
    {
      cle: "taches",
      libelle: "À faire",
      resultats: (taches.data ?? []).map((t) => ({
        id: t.id,
        href: `/taches?search=${encodeURIComponent(t.titre.slice(0, 40))}`,
        titre: t.titre,
        sousTitre: t.date_echeance ? `Échéance ${formatDateFr(t.date_echeance)}` : null,
        etiquette: t.fait ? "Faite" : null,
      })),
    },
  ];

  return { ok: true, data: { groupes } };
}
