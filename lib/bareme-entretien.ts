/**
 * Barème d'entretien — logique PURE, testée dans bareme-entretien.test.ts.
 *
 * Reproduit le barème Excel de tarification : chaque poste (split,
 * CTA, PAC, VMC, VRV, unité intérieure, filtre…) a un prix unitaire
 * DÉGRESSIF par tranche de quantité ; le total d'un poste est le prix
 * de la tranche atteinte × le nombre d'unités. Un forfait de
 * déplacement par zone s'ajoute au total (km × tarif au km + péage +
 * temps de route × taux horaire).
 *
 * FRANCHISE EN BASE DE TVA : tous les montants sont NETS. Ce module
 * n'ajoute aucune taxe nulle part, et un test le garantit.
 *
 * Les valeurs par défaut ci-dessous reproduisent le barème d'origine ;
 * elles ne servent qu'à initialiser la table de l'utilisateur, qui les
 * modifie ensuite dans Paramètres → Barème entretien.
 */

export type Tranche = {
  /** Nombre d'unités à partir duquel ce prix s'applique (1 = première tranche). */
  a_partir_de: number;
  /** Prix unitaire NET de la tranche. */
  prix: number;
};

export const GROUPES_BAREME = {
  split: "Splits et PAC air-air",
  cta: "Centrales de traitement d'air",
  pac: "Pompes à chaleur",
  vmc: "VMC",
  vrv: "VRV / DRV",
} as const;

export type GroupeBareme = keyof typeof GROUPES_BAREME;

export type PosteBareme = {
  id?: string;
  /** Identifiant stable (jamais affiché). */
  code: string;
  groupe: GroupeBareme;
  libelle: string;
  unite: string;
  tranches: Tranche[];
  ordre: number;
  actif: boolean;
};

export type ZoneBareme = {
  id?: string;
  code: string;
  libelle: string;
  /** Distance aller-retour, en km. */
  distance_km: number;
  /** Péages aller-retour, net. */
  peage: number;
  /** Temps de route aller-retour, en heures. */
  temps_route_h: number;
  ordre: number;
  actif: boolean;
};

export type ReglagesBareme = {
  /** € par km (carburant + usure). */
  tarif_km: number;
  /** € par heure de route. */
  taux_horaire: number;
};

export type BaremeEntretien = {
  postes: PosteBareme[];
  zones: ZoneBareme[];
  reglages: ReglagesBareme;
};

export const arrondi = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Barème par défaut (celui du fichier Excel d'origine, sans sa TVA)
// ---------------------------------------------------------------------------

const t = (...paires: Array<[number, number]>): Tranche[] =>
  paires.map(([a_partir_de, prix]) => ({ a_partir_de, prix }));

/**
 * Tranches « moins de 2 / 2 à 5 / plus de 6 » du barème d'origine.
 * Le barème ne dit rien de 6 unités exactement : la tranche la plus
 * basse s'applique dès 6 (« 6 et plus »), à l'avantage du client.
 */
export const BAREME_PAR_DEFAUT: BaremeEntretien = {
  postes: [
    { code: "split_reversible", groupe: "split", libelle: "Split réversible / PAC air-air", unite: "unité", tranches: t([1, 189], [2, 146], [6, 105]), ordre: 10, actif: true },
    { code: "split_froid", groupe: "split", libelle: "Split froid seul", unite: "unité", tranches: t([1, 126], [2, 105], [6, 63]), ordre: 20, actif: true },
    { code: "ui_multi_reversible", groupe: "split", libelle: "Unité intérieure supplémentaire (multi) — réversible", unite: "unité", tranches: t([1, 17]), ordre: 30, actif: true },
    { code: "ui_multi_froid", groupe: "split", libelle: "Unité intérieure supplémentaire (multi) — froid seul", unite: "unité", tranches: t([1, 9]), ordre: 40, actif: true },
    { code: "cta", groupe: "cta", libelle: "Centrale de traitement d'air (CTA)", unite: "unité", tranches: t([1, 500], [2, 395], [6, 275]), ordre: 50, actif: true },
    { code: "filtre_g4", groupe: "cta", libelle: "Filtre CTA G4 à changer", unite: "filtre", tranches: t([1, 45]), ordre: 60, actif: true },
    { code: "filtre_f7", groupe: "cta", libelle: "Filtre CTA F7 à changer", unite: "filtre", tranches: t([1, 120]), ordre: 70, actif: true },
    { code: "pac", groupe: "pac", libelle: "Pompe à chaleur", unite: "unité", tranches: t([1, 120], [2, 100], [6, 60]), ordre: 80, actif: true },
    { code: "vmc_simple", groupe: "vmc", libelle: "VMC simple flux", unite: "unité", tranches: t([1, 60], [2, 46], [6, 33]), ordre: 90, actif: true },
    { code: "vmc_double", groupe: "vmc", libelle: "VMC double flux", unite: "unité", tranches: t([1, 128], [2, 100], [6, 60]), ordre: 100, actif: true },
    // Troisième catégorie VMC du barème (180 / 139 / 100 €) : libellé à
    // préciser par l'utilisateur, modifiable dans les réglages.
    { code: "vmc_autre", groupe: "vmc", libelle: "VMC (3e catégorie — libellé à préciser)", unite: "unité", tranches: t([1, 180], [2, 139], [6, 100]), ordre: 110, actif: true },
    { code: "vrv", groupe: "vrv", libelle: "VRV / DRV (groupe)", unite: "unité", tranches: t([1, 380], [2, 285]), ordre: 120, actif: true },
    { code: "ui_vrv_reversible", groupe: "vrv", libelle: "Unité intérieure VRV — réversible", unite: "unité", tranches: t([1, 17]), ordre: 130, actif: true },
    { code: "ui_vrv_froid", groupe: "vrv", libelle: "Unité intérieure VRV — froid seul", unite: "unité", tranches: t([1, 9]), ordre: 140, actif: true },
  ],
  zones: [
    { code: "grenoble", libelle: "Grenoble et agglomération", distance_km: 15, peage: 0, temps_route_h: 1, ordre: 10, actif: true },
    { code: "chambery", libelle: "Chambéry", distance_km: 150, peage: 14, temps_route_h: 1.5, ordre: 20, actif: true },
    { code: "lyon", libelle: "Lyon", distance_km: 250, peage: 22, temps_route_h: 3, ordre: 30, actif: true },
  ],
  reglages: { tarif_km: 0.6, taux_horaire: 25 },
};

// ---------------------------------------------------------------------------
// Tranches
// ---------------------------------------------------------------------------

/** Tranches triées par seuil croissant (copie). */
export function trierTranches(tranches: Tranche[]): Tranche[] {
  return [...tranches].sort((a, b) => a.a_partir_de - b.a_partir_de);
}

/**
 * Prix unitaire applicable à `quantite` : la tranche au seuil le plus
 * élevé qui reste ≤ quantité. Null si la quantité est nulle/négative
 * ou si aucune tranche ne couvre cette quantité.
 */
export function prixUnitaire(tranches: Tranche[], quantite: number): number | null {
  if (!Number.isFinite(quantite) || quantite < 1) return null;
  let retenue: Tranche | null = null;
  for (const tr of trierTranches(tranches)) {
    if (tr.a_partir_de <= quantite) retenue = tr;
  }
  return retenue ? retenue.prix : null;
}

/** Libellé lisible d'une tranche : « 1 », « 2 à 5 », « 6 et plus ». */
export function libelleTranche(tranches: Tranche[], index: number): string {
  const triees = trierTranches(tranches);
  const tr = triees[index];
  if (!tr) return "";
  const suivante = triees[index + 1];
  if (!suivante) return tr.a_partir_de === 1 ? "par unité" : `${tr.a_partir_de} et plus`;
  const fin = suivante.a_partir_de - 1;
  return fin === tr.a_partir_de ? `${tr.a_partir_de}` : `${tr.a_partir_de} à ${fin}`;
}

export type ResultatValidation<T> =
  | { ok: true; valeur: T }
  | { ok: false; error: string };

/**
 * Valide des tranches saisies : au moins une, seuils entiers ≥ 1 sans
 * doublon, prix ≥ 0, et une tranche qui commence à 1 (sinon une seule
 * unité n'aurait pas de prix).
 */
export function normaliserTranches(saisie: unknown): ResultatValidation<Tranche[]> {
  if (!Array.isArray(saisie) || saisie.length === 0) {
    return { ok: false, error: "Indiquez au moins une tranche de prix." };
  }
  const tranches: Tranche[] = [];
  for (const item of saisie) {
    const o = (item ?? {}) as Record<string, unknown>;
    const seuil = Number(o.a_partir_de);
    const prix = Number(o.prix);
    if (!Number.isInteger(seuil) || seuil < 1) {
      return { ok: false, error: "Le seuil d'une tranche est un nombre entier d'unités (1 ou plus)." };
    }
    if (!Number.isFinite(prix) || prix < 0) {
      return { ok: false, error: "Le prix d'une tranche est un montant positif ou nul." };
    }
    if (tranches.some((tr) => tr.a_partir_de === seuil)) {
      return { ok: false, error: `Deux tranches commencent à ${seuil} unités.` };
    }
    tranches.push({ a_partir_de: seuil, prix: arrondi(prix) });
  }
  const triees = trierTranches(tranches);
  if (triees[0]!.a_partir_de !== 1) {
    return { ok: false, error: "La première tranche doit commencer à 1 unité." };
  }
  return { ok: true, valeur: triees };
}

// ---------------------------------------------------------------------------
// Déplacement
// ---------------------------------------------------------------------------

export type DetailZone = {
  kilometrage: number;
  peage: number;
  tempsRoute: number;
  total: number;
};

/** Forfait de déplacement d'une zone : km × tarif + péage + heures × taux. */
export function coutZone(zone: ZoneBareme, reglages: ReglagesBareme): DetailZone {
  const kilometrage = arrondi(zone.distance_km * reglages.tarif_km);
  const peage = arrondi(zone.peage);
  const tempsRoute = arrondi(zone.temps_route_h * reglages.taux_horaire);
  return { kilometrage, peage, tempsRoute, total: arrondi(kilometrage + peage + tempsRoute) };
}

// ---------------------------------------------------------------------------
// Calcul complet
// ---------------------------------------------------------------------------

export type SelectionEntretien = {
  /** Quantité par code de poste (absent ou 0 = non retenu). */
  quantites: Record<string, number>;
  /** Code de la zone de déplacement, null = pas de déplacement facturé. */
  zoneCode: string | null;
};

export type LigneCalcul = {
  code: string;
  libelle: string;
  unite: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
};

export type ResultatCalcul = {
  lignes: LigneCalcul[];
  deplacement: { zone: ZoneBareme; detail: DetailZone } | null;
  sousTotalEquipements: number;
  total: number;
};

/**
 * Chiffre une sélection : une ligne par poste retenu (quantité entière
 * ≥ 1, poste actif, tranche trouvée), plus le déplacement de la zone.
 * Total = somme des lignes + déplacement. Rien d'autre — aucune taxe.
 */
export function calculerEntretien(
  bareme: BaremeEntretien,
  selection: SelectionEntretien,
): ResultatCalcul {
  const lignes: LigneCalcul[] = [];
  const postes = [...bareme.postes].sort((a, b) => a.ordre - b.ordre);
  for (const poste of postes) {
    if (!poste.actif) continue;
    const quantite = Math.floor(Number(selection.quantites[poste.code]) || 0);
    if (quantite < 1) continue;
    const pu = prixUnitaire(poste.tranches, quantite);
    if (pu === null) continue;
    lignes.push({
      code: poste.code,
      libelle: poste.libelle,
      unite: poste.unite,
      quantite,
      prixUnitaire: pu,
      total: arrondi(quantite * pu),
    });
  }

  const zone = selection.zoneCode
    ? bareme.zones.find((z) => z.code === selection.zoneCode && z.actif) ?? null
    : null;
  const deplacement = zone ? { zone, detail: coutZone(zone, bareme.reglages) } : null;

  const sousTotalEquipements = arrondi(lignes.reduce((s, l) => s + l.total, 0));
  const total = arrondi(sousTotalEquipements + (deplacement?.detail.total ?? 0));
  return { lignes, deplacement, sousTotalEquipements, total };
}

// ---------------------------------------------------------------------------
// Vers les documents
// ---------------------------------------------------------------------------

export type LigneDocumentEntretien = {
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  prix_achat_ttc_unitaire: null;
  fournisseur: "";
  nature_fiscale: "bic_prestations";
  type: "ligne";
};

/**
 * Lignes prêtes pour l'éditeur de devis : une par poste (« Entretien
 * annuel — Split réversible / PAC air-air », qté 3 × 146 €) et une pour
 * le déplacement (qté 1 × forfait). Ajustables ensuite comme n'importe
 * quelle ligne.
 */
export function lignesDocumentDepuisCalcul(calcul: ResultatCalcul): LigneDocumentEntretien[] {
  const base = {
    prix_achat_ttc_unitaire: null,
    fournisseur: "",
    nature_fiscale: "bic_prestations",
    type: "ligne",
  } as const;
  const lignes: LigneDocumentEntretien[] = calcul.lignes.map((l) => ({
    designation: `Entretien annuel — ${l.libelle}`,
    quantite: l.quantite,
    prix_unitaire_ht: l.prixUnitaire,
    ...base,
  }));
  if (calcul.deplacement) {
    const { zone, detail } = calcul.deplacement;
    lignes.push({
      designation: `Déplacement — zone ${zone.libelle}`,
      quantite: 1,
      prix_unitaire_ht: detail.total,
      ...base,
    });
  }
  return lignes;
}

export type EquipementContratCalcul = {
  type: string;
  marque_modele: string;
  num_serie: string;
  puissance_kw: string;
  fluide_charge: string;
};

/**
 * Section « Installation couverte » d'un contrat : une ligne par UNITÉ
 * (3 splits → 3 lignes « Split réversible / PAC air-air »), le reste à
 * compléter (marque, n° de série…). Les filtres ne sont pas des
 * équipements couverts : ils sont laissés de côté.
 */
export function equipementsContratDepuisCalcul(
  calcul: ResultatCalcul,
): EquipementContratCalcul[] {
  const out: EquipementContratCalcul[] = [];
  for (const l of calcul.lignes) {
    if (l.unite === "filtre") continue;
    for (let i = 0; i < l.quantite; i++) {
      out.push({ type: l.libelle, marque_modele: "", num_serie: "", puissance_kw: "", fluide_charge: "" });
    }
  }
  return out;
}
