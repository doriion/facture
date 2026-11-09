/**
 * Clôture d'une intervention — logique PURE, testée : propositions de
 * facturation en un tap (devis accepté du client, article du catalogue
 * qui correspond au descriptif, barème d'entretien, sinon ligne libre à
 * compléter) et poste du barème deviné d'après le texte.
 */

import { calculerEntretien, lignesDocumentDepuisCalcul, type BaremeEntretien } from "@/lib/bareme-entretien";
import { computeHeuresFacturables } from "@/lib/facture-prefill";
import { chercherPrestations, ligneDepuisPrestation, normaliser, type PrestationCatalogue } from "@/lib/catalogue-recherche";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";

export type LigneProposee = {
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  prix_achat_ttc_unitaire: number | null;
  fournisseur: string;
  nature_fiscale: string;
  type: "ligne" | "titre";
};

export type PropositionFacturation = {
  source: "devis" | "catalogue" | "bareme" | "libre";
  /** « Devis D-2026-0031 accepté », « Article du catalogue », « Barème d'entretien », « À compléter » */
  titre: string;
  detail: string;
  devisId?: string;
  lignes: LigneProposee[];
  totalHt: number;
  /** Facture envoyable telle quelle (prix connus). */
  prete: boolean;
};

export type DevisPourCloture = {
  id: string;
  numero: string;
  total_ht: number;
  lignes: Array<{ designation: string; quantite: number; prix_unitaire_ht: number; prix_achat_ttc_unitaire: number | null; fournisseur: string | null; nature_fiscale: string | null; type: string | null }>;
};

export type InterventionPourCloture = {
  type: string;
  description: string | null;
  equipement_marque: string | null;
  equipement_modele: string | null;
  duree_minutes: number | null;
  heure_debut: string | null;
  heure_fin: string | null;
  date_intervention: string;
  date_fin: string | null;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;
const total = (lignes: LigneProposee[]) => arrondi(lignes.filter((l) => l.type === "ligne").reduce((s, l) => s + l.quantite * l.prix_unitaire_ht, 0));

/** Poste du barème d'entretien deviné d'après le descriptif et le matériel. */
export function posteBaremeDevine(texte: string): string | null {
  const t = normaliser(texte);
  if (!t) return null;
  if (/\bvmc\b.*double|double flux/.test(t)) return "vmc_double";
  if (/\bvmc\b/.test(t)) return "vmc_simple";
  if (/\bcta\b|centrale de traitement/.test(t)) return "cta";
  if (/\bvrv\b|\bdrv\b/.test(t)) return "vrv";
  if (/\bpac\b|pompe a chaleur|pompe à chaleur/.test(t)) return "pac";
  if (/clim|split|reversible|mono|multi|gainable|cassette|console/.test(t)) return "split_reversible";
  return null;
}

/** Première ligne du descriptif (le nom du client quand il est tapé dans le texte). */
function premiereLigne(texte: string | null): string {
  return (texte ?? "").split(/\r?\n/)[0]?.trim() ?? "";
}

export function propositionsFacturation(args: {
  intervention: InterventionPourCloture;
  devisAcceptes: DevisPourCloture[];
  catalogue: PrestationCatalogue[];
  bareme: BaremeEntretien | null;
}): PropositionFacturation[] {
  const { intervention: it } = args;
  const props: PropositionFacturation[] = [];
  const typeLabel = LABELS_TYPE_INTERVENTION[it.type as keyof typeof LABELS_TYPE_INTERVENTION] ?? it.type;

  // 1. Devis accepté du client, pas encore facturé : c'est la facture attendue.
  for (const d of args.devisAcceptes) {
    const lignes: LigneProposee[] = d.lignes.map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite),
      prix_unitaire_ht: Number(l.prix_unitaire_ht),
      prix_achat_ttc_unitaire: l.prix_achat_ttc_unitaire === null ? null : Number(l.prix_achat_ttc_unitaire),
      fournisseur: l.fournisseur ?? "",
      nature_fiscale: l.nature_fiscale ?? "bic_prestations",
      type: l.type === "titre" ? "titre" : "ligne",
    }));
    props.push({
      source: "devis",
      titre: `Devis ${d.numero} accepté`,
      detail: `${lignes.filter((l) => l.type === "ligne").length} ligne(s) du devis, converti en facture`,
      devisId: d.id,
      lignes,
      totalHt: arrondi(Number(d.total_ht)),
      prete: true,
    });
  }

  // 2. Article du catalogue qui correspond au descriptif (ou au type).
  const heures = computeHeuresFacturables(it);
  const requete = premiereLigne(it.description) || typeLabel;
  const candidats = [requete, typeLabel].flatMap((q) => chercherPrestations(args.catalogue, q, { limite: 1 }));
  const article = candidats[0];
  if (article) {
    const base = ligneDepuisPrestation(article);
    const lignes: LigneProposee[] = [{ ...base, quantite: 1, type: "ligne" }];
    props.push({
      source: "catalogue",
      titre: article.designation,
      detail: "Article de votre catalogue",
      lignes,
      totalHt: total(lignes),
      prete: total(lignes) > 0,
    });
  }

  // 3. Barème d'entretien (entretien ou poste reconnu dans le texte).
  if (args.bareme) {
    const poste = posteBaremeDevine([it.description, it.equipement_marque, it.equipement_modele].filter(Boolean).join(" ")) ?? (it.type === "entretien" ? "split_reversible" : null);
    if (poste && args.bareme.postes.some((p) => p.code === poste && p.actif)) {
      const calcul = calculerEntretien(args.bareme, { quantites: { [poste]: 1 }, zoneCode: null });
      const lignes: LigneProposee[] = lignesDocumentDepuisCalcul(calcul).map((l) => ({ ...l, type: "ligne" }));
      if (lignes.length > 0) {
        props.push({
          source: "bareme",
          titre: lignes[0]!.designation,
          detail: "Barème d'entretien (1 unité, sans déplacement)",
          lignes,
          totalHt: total(lignes),
          prete: total(lignes) > 0,
        });
      }
    }
  }

  // 4. Ligne libre : descriptif, heures si connues, prix à compléter.
  const equipement = [it.equipement_marque, it.equipement_modele].filter(Boolean).join(" ");
  const designation = it.description?.trim().replace(/\s*\n\s*/g, " — ") || (equipement ? `${typeLabel} — ${equipement}` : typeLabel);
  props.push({
    source: "libre",
    titre: "À compléter",
    detail: heures ? `${designation} · ${heures} h, prix à saisir` : "Descriptif repris, prix à saisir",
    lignes: [{ designation, quantite: heures ?? 1, prix_unitaire_ht: 0, prix_achat_ttc_unitaire: null, fournisseur: "", nature_fiscale: "bic_prestations", type: "ligne" }],
    totalHt: 0,
    prete: false,
  });
  return props;
}
