/**
 * Construction des données de la fiche d'intervention fluides
 * frigorigènes — trame CERFA n° 15497*04 (arrêté du 29 mai 2024,
 * applicable depuis le 6 juillet 2024 ; notice n° 52064*04).
 *
 * Helpers PURS (pas de "use server", pas d'accès base) : la server
 * action assemble intervention + client + profil et appelle
 * buildCerfaData ; le composant PDF ne fait que du rendu.
 *
 * Réimplémentation de la structure du formulaire officiel (14 cadres),
 * sans copie du document : opérateur, détenteur, équipement (charge kg
 * + t éq. CO2 + PRG), nature de l'intervention, détecteur, système
 * permanent de détection, périodicité, fuites, quantités manipulées
 * (chargé A/B/C, récupéré D/E), déchets (BSFF), observations,
 * signatures opérateur et détenteur.
 */

import {
  equivalentCo2Tonnes,
  normalizeFluide,
  periodiciteControleMois,
  prgFluide,
} from "@/lib/fluides";
import type { Database } from "@/types/database";

type Intervention = Database["public"]["Tables"]["interventions"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

/** Cadre 4 du CERFA 15497*04 : natures d'intervention (cases à cocher). */
export const NATURES_INTERVENTION = {
  assemblage: "Assemblage",
  mise_en_service: "Mise en service",
  modification: "Modification de l'équipement",
  maintenance: "Maintenance de l'équipement",
  controle_periodique: "Contrôle d'étanchéité périodique",
  controle_non_periodique: "Contrôle d'étanchéité non périodique",
  demantelement: "Démantèlement de l'équipement",
} as const;

export type NatureIntervention = keyof typeof NATURES_INTERVENTION;

/** Options saisies dans le dialogue de génération (spécifiques CERFA). */
export type CerfaOptions = {
  ficheNumero?: string;
  natures: NatureIntervention[];
  systemePermanentDetection: boolean;
  /** Ventilation du fluide chargé (kg) — cadre 11 A/B/C */
  chargeViergeKg?: number | null;
  chargeRecycleKg?: number | null;
  chargeRegenereKg?: number | null;
  /** Ventilation du fluide récupéré (kg) — cadre 11 D/E */
  recupereTraitementKg?: number | null;
  recupereReutilisationKg?: number | null;
  /** Cadres 12-13 — uniquement si l'intervention génère des déchets */
  dechets?: {
    codeUn?: string;
    contenants?: string;
    numeroBsff?: string;
    destinationNom?: string;
    destinationAdresse?: string;
  } | null;
};

export type CerfaData = {
  version: string;
  ficheNumero: string;
  dateIntervention: string;
  operateur: {
    nom: string;
    adresse: string;
    siret: string;
    attestationCapacite: string;
  };
  detenteur: {
    nom: string;
    adresse: string;
    siret: string;
  };
  equipement: {
    description: string;
    marqueModele: string;
    numeroSerie: string;
    fluide: string;
    prg: number | null;
    chargeKg: number | null;
    chargeTeqCo2: number | null;
  };
  natures: NatureIntervention[];
  detecteur: {
    identification: string;
    dernierControle: string;
  } | null;
  systemePermanentDetection: boolean;
  periodiciteMois: number | null;
  fuite: {
    constatee: boolean | null;
    localisation: string;
  };
  quantites: {
    chargeViergeKg: number;
    chargeRecycleKg: number;
    chargeRegenereKg: number;
    totalChargeKg: number;
    recupereTraitementKg: number;
    recupereReutilisationKg: number;
    totalRecupereKg: number;
  };
  dechets: {
    codeUn: string;
    contenants: string;
    numeroBsff: string;
    destinationNom: string;
    destinationAdresse: string;
  } | null;
  observations: string;
};

function n(v: number | null | undefined): number {
  return v === null || v === undefined || !Number.isFinite(v) ? 0 : v;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/**
 * Natures d'intervention proposées par défaut à partir des données de
 * l'intervention : type (installation → mise en service, dépannage →
 * maintenance…) + contrôle d'étanchéité si effectué. L'utilisateur
 * ajuste ensuite dans le dialogue de génération.
 */
export function naturesParDefaut(intervention: {
  type: string;
  etancheite_controle: boolean | null;
}): NatureIntervention[] {
  const natures: NatureIntervention[] = [];
  switch (intervention.type) {
    case "installation":
      natures.push("assemblage", "mise_en_service");
      break;
    case "depannage":
    case "entretien":
      natures.push("maintenance");
      break;
  }
  if (intervention.etancheite_controle) {
    // Sans précision contraire, un contrôle isolé est réputé périodique ;
    // après réparation il est « non périodique » (à ajuster dans le dialogue).
    natures.push("controle_periodique");
  }
  return natures;
}

/**
 * Assemble les données complètes de la fiche à partir de l'intervention,
 * du client (détenteur), du profil (opérateur) et des options du
 * dialogue. La ventilation chargé/récupéré retombe par défaut sur les
 * kg de l'intervention (chargé = vierge, récupéré = pour traitement).
 */
export function buildCerfaData(
  intervention: Intervention,
  client: Client | null,
  profil: Profil | null,
  options: CerfaOptions,
): CerfaData {
  const fluide = normalizeFluide(intervention.fluide_frigo_type);
  const chargeKg =
    intervention.fluide_charge_totale_kg !== null
      ? Number(intervention.fluide_charge_totale_kg)
      : null;

  const chargeViergeKg = round3(
    options.chargeViergeKg !== undefined && options.chargeViergeKg !== null
      ? options.chargeViergeKg
      : n(
          intervention.fluide_frigo_kg_ajoute !== null
            ? Number(intervention.fluide_frigo_kg_ajoute)
            : null,
        ),
  );
  const chargeRecycleKg = round3(n(options.chargeRecycleKg));
  const chargeRegenereKg = round3(n(options.chargeRegenereKg));

  const recupereTraitementKg = round3(
    options.recupereTraitementKg !== undefined &&
      options.recupereTraitementKg !== null
      ? options.recupereTraitementKg
      : n(
          intervention.fluide_frigo_kg_recupere !== null
            ? Number(intervention.fluide_frigo_kg_recupere)
            : null,
        ),
  );
  const recupereReutilisationKg = round3(n(options.recupereReutilisationKg));

  const operateurAdresse = [
    profil?.adresse_ligne1,
    profil?.adresse_ligne2,
    [profil?.code_postal, profil?.ville].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const detenteurAdresse = [
    client?.adresse_ligne1,
    client?.adresse_ligne2,
    [client?.code_postal, client?.ville].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const operateurNom =
    profil?.nom_commercial ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ");

  return {
    version: "Trame conforme au CERFA n° 15497*04",
    ficheNumero:
      options.ficheNumero?.trim() ||
      `FI-${intervention.date_intervention}-${intervention.id.slice(0, 6).toUpperCase()}`,
    dateIntervention: intervention.date_intervention,
    operateur: {
      nom: operateurNom || "—",
      adresse: operateurAdresse || "—",
      siret: profil?.siret ?? "—",
      attestationCapacite: profil?.num_attestation_fluides_frigo ?? "—",
    },
    detenteur: {
      nom: client?.nom ?? "—",
      adresse: detenteurAdresse || "—",
      siret: client?.siret ?? "",
    },
    equipement: {
      description: intervention.description ?? "",
      marqueModele: [
        intervention.equipement_marque,
        intervention.equipement_modele,
      ]
        .filter(Boolean)
        .join(" "),
      numeroSerie: intervention.equipement_num_serie ?? "",
      fluide: fluide || "—",
      prg: prgFluide(fluide),
      chargeKg,
      chargeTeqCo2: equivalentCo2Tonnes(fluide, chargeKg),
    },
    natures: options.natures,
    detecteur:
      intervention.etancheite_controle && intervention.etancheite_detecteur
        ? {
            identification: intervention.etancheite_detecteur,
            dernierControle:
              intervention.etancheite_detecteur_controle_le ?? "",
          }
        : null,
    systemePermanentDetection: options.systemePermanentDetection,
    periodiciteMois: options.systemePermanentDetection
      ? null
      : periodiciteControleMois(chargeKg),
    fuite: {
      constatee: intervention.etancheite_controle
        ? intervention.etancheite_fuite
        : null,
      localisation: intervention.etancheite_fuite_localisation ?? "",
    },
    quantites: {
      chargeViergeKg,
      chargeRecycleKg,
      chargeRegenereKg,
      totalChargeKg: round3(chargeViergeKg + chargeRecycleKg + chargeRegenereKg),
      recupereTraitementKg,
      recupereReutilisationKg,
      totalRecupereKg: round3(recupereTraitementKg + recupereReutilisationKg),
    },
    dechets:
      options.dechets &&
      (options.dechets.codeUn ||
        options.dechets.numeroBsff ||
        options.dechets.destinationNom ||
        options.dechets.contenants ||
        options.dechets.destinationAdresse)
        ? {
            codeUn: options.dechets.codeUn ?? "",
            contenants: options.dechets.contenants ?? "",
            numeroBsff: options.dechets.numeroBsff ?? "",
            destinationNom: options.dechets.destinationNom ?? "",
            destinationAdresse: options.dechets.destinationAdresse ?? "",
          }
        : null,
    observations: intervention.fluide_observations ?? "",
  };
}
