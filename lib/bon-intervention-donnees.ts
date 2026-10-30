/**
 * Construction des données du bon d'intervention / bon de réception —
 * logique PURE (pas d'accès base), partagée par la server action du
 * bon et par la génération des documents d'une fiche gaz.
 */

import { aujourdhuiParis } from "@/lib/dates";
import { coordonneesEmetteur, enseigneEmetteur, ligneePiedDePage } from "@/lib/devis-modele";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";
import type { BonInterventionData } from "@/components/interventions/bon-intervention-pdf";
import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Intervention = Database["public"]["Tables"]["interventions"]["Row"];
type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

function adresseClient(client: Client | null): string[] {
  if (!client) return [];
  return [
    client.adresse_ligne1 ?? "",
    client.adresse_ligne2 ?? "",
    [client.code_postal, client.ville].filter(Boolean).join(" "),
  ]
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Données figées du bon (snapshot archivé avec le PDF). Pour une fiche
 * gaz, le bloc « réception des travaux » (objet, n° de devis, réserves)
 * est rempli et le bon devient un bon de réception.
 */
export function construireDonneesBon(
  intervention: Intervention,
  client: Client | null,
  profil: Profil | null,
  factureNumero: string | null,
): BonInterventionData {
  const aFluides = Boolean(
    intervention.fluide_frigo_type ||
      intervention.fluide_frigo_kg_ajoute ||
      intervention.fluide_frigo_kg_recupere ||
      intervention.etancheite_controle !== null,
  );
  return {
    entreprise: {
      nom: enseigneEmetteur(profil),
      adresse: coordonneesEmetteur(profil).filter(
        (l) => l !== (profil?.telephone ?? "").trim() && l !== (profil?.email_pro ?? "").trim(),
      ),
      telephone: profil?.telephone ?? null,
      email: profil?.email_pro ?? null,
      piedDePage: ligneePiedDePage(profil, intervention.date_intervention),
    },
    client: client
      ? {
          nom: client.raison_sociale || client.nom,
          adresse: adresseClient(client),
          telephone: client.telephone ?? null,
          email: client.email ?? null,
        }
      : null,
    dateIntervention: intervention.date_intervention,
    dateFin: intervention.date_fin,
    heureDebut: intervention.heure_debut ? intervention.heure_debut.slice(0, 5) : null,
    heureFin: intervention.heure_fin ? intervention.heure_fin.slice(0, 5) : null,
    dureeMinutes: intervention.duree_minutes,
    typeLabel:
      LABELS_TYPE_INTERVENTION[intervention.type as keyof typeof LABELS_TYPE_INTERVENTION] ??
      intervention.type,
    description: intervention.description,
    equipement: {
      marque: intervention.equipement_marque,
      modele: intervention.equipement_modele,
      numSerie: intervention.equipement_num_serie,
    },
    fluides: aFluides
      ? {
          type: intervention.fluide_frigo_type,
          kgAjoute: intervention.fluide_frigo_kg_ajoute,
          kgRecupere: intervention.fluide_frigo_kg_recupere,
          etancheiteControle: intervention.etancheite_controle,
          fuite: intervention.etancheite_fuite,
          observations: intervention.fluide_observations,
        }
      : null,
    factureNumero,
    genereLe: aujourdhuiParis(),
    reception: intervention.est_fiche_gaz
      ? {
          ficheNumero: intervention.fiche_numero,
          objet: intervention.bon_objet,
          devisNumero: intervention.bon_devis_numero,
          reserves: intervention.bon_reserves === "sans" || intervention.bon_reserves === "avec" ? intervention.bon_reserves : null,
          reservesTexte: intervention.bon_reserves_texte,
        }
      : null,
  };
}
