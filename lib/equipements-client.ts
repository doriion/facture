/**
 * Équipements d'un client, déduits de ses interventions (helper PUR,
 * testé). Un équipement = un numéro de série, ou à défaut un couple
 * marque + modèle. On garde la dernière intervention vue et le nombre
 * de passages : sur la fiche client, ça répond à « qu'est-ce qu'il a
 * chez lui et depuis quand ? » sans ressaisie.
 */

export type InterventionEquipement = {
  date_intervention: string;
  equipement_marque: string | null;
  equipement_modele: string | null;
  equipement_num_serie: string | null;
  fluide_frigo_type?: string | null;
};

export type EquipementClient = {
  cle: string;
  marque: string | null;
  modele: string | null;
  numSerie: string | null;
  fluide: string | null;
  derniereIntervention: string;
  nbInterventions: number;
};

function propre(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

export function equipementsDepuisInterventions(
  interventions: InterventionEquipement[],
): EquipementClient[] {
  const parCle = new Map<string, EquipementClient>();
  for (const i of interventions) {
    const marque = propre(i.equipement_marque);
    const modele = propre(i.equipement_modele);
    const numSerie = propre(i.equipement_num_serie);
    if (!marque && !modele && !numSerie) continue;
    const cle = numSerie
      ? `serie:${numSerie.toLowerCase()}`
      : `modele:${(marque ?? "").toLowerCase()}|${(modele ?? "").toLowerCase()}`;
    const existant = parCle.get(cle);
    if (existant) {
      existant.nbInterventions += 1;
      if (i.date_intervention > existant.derniereIntervention) {
        existant.derniereIntervention = i.date_intervention;
      }
      // Complète ce qui manquait (une intervention plus ancienne sans marque…)
      existant.marque = existant.marque ?? marque;
      existant.modele = existant.modele ?? modele;
      existant.fluide = existant.fluide ?? propre(i.fluide_frigo_type);
    } else {
      parCle.set(cle, {
        cle,
        marque,
        modele,
        numSerie,
        fluide: propre(i.fluide_frigo_type),
        derniereIntervention: i.date_intervention,
        nbInterventions: 1,
      });
    }
  }
  return Array.from(parCle.values()).sort((a, b) =>
    a.derniereIntervention < b.derniereIntervention ? 1 : -1,
  );
}
