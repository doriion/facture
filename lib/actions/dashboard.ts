"use server";

import { createClient } from "@/lib/supabase/server";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";
import { buildExportUrssaf } from "@/lib/actions/export-urssaf";
import { getBaremeCotisations } from "@/lib/actions/cotisations";
import { computeTauxConversionDevis } from "@/lib/devis-stats";
import { derniers12Mois } from "@/lib/mois";
import { alerteValidite, type AlerteValidite } from "@/lib/attestations";
import {
  prochaineBascule,
  provisionCotisations,
  tauxTotalPct,
  trimestreCourant,
  type ProvisionCotisations,
} from "@/lib/cotisations";

export type DashboardData = {
  annee: number;
  // KPIs
  caMois: number;
  caEncaisseMois: number;
  caAnnee: number;
  caMoisPrecedent: number;
  nbFacturesImpayees: number;
  montantImpaye: number;
  nbDevisEnAttente: number;
  tauxConversionDevis: number | null; // % accepté / (accepté + envoyé + refusé), null si aucun
  // Suivi seuils micro (jauges) — CA ENCAISSÉ de l'année (base URSSAF),
  // les seuils eux-mêmes sont des constantes (lib/seuils-micro.ts)
  caEncaisseAnnee: number;
  // Cotisations à provisionner sur l'encaissé du trimestre en cours
  cotisations: {
    trimestreLabel: string;
    encaisseTrimestre: number;
    provision: ProvisionCotisations | null;
    /** Hausse de taux dans les 6 mois (fin d'ACRE) — pour l'avertissement */
    bascule: {
      date: string;
      tauxAvantPct: number;
      tauxApresPct: number;
    } | null;
  };
  // Graphes
  caParMois: Array<{
    mois: string;
    plomberie: number;
    clim: number;
    pac: number;
    entretien: number;
    depannage: number;
    autre: number;
    total: number;
  }>;
  caParActivite: Array<{ activite: string; libelle: string; montant: number }>;
  // Listes
  topClients: Array<{ id: string; nom: string; total: number; nbFactures: number }>;
  facturesRecentes: Array<{
    id: string;
    numero: string;
    date_emission: string;
    total_ht: number;
    statut: string;
    client_nom: string | null;
  }>;
  devisRecents: Array<{
    id: string;
    numero: string;
    date_emission: string;
    date_validite: string;
    total_ht: number;
    statut: string;
    client_nom: string | null;
  }>;
  // Alertes
  facturesEnRetard: Array<{
    id: string;
    numero: string;
    date_echeance: string;
    total_ht: number;
    client_nom: string | null;
    joursRetard: number;
  }>;
  devisExpirantBientot: Array<{
    id: string;
    numero: string;
    date_validite: string;
    total_ht: number;
    client_nom: string | null;
    joursAvantExpiration: number;
  }>;
  prochainesVisitesMaintenance: Array<{
    id: string;
    prochaine_visite: string;
    intitule: string | null;
    client_nom: string | null;
  }>;
  /** Attestations à renouveler (décennale, fluides) — alerte J-30, rouge si dépassée */
  attestations: Array<{
    label: string;
    dateFin: string;
    alerte: AlerteValidite;
  }>;
};

/**
 * Agrégations pour le dashboard. Tout en une seule fonction pour minimiser
 * le nombre d'allers-retours réseau. Les volumes manipulés (quelques
 * centaines de docs par user et par an) permettent de faire l'agrégation
 * côté Node sans souci de perf.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createClient();
  const now = new Date();
  const annee = now.getFullYear();
  const mois = now.getMonth(); // 0-11
  const today = now.toISOString().slice(0, 10);

  const startOfYear = `${annee}-01-01`;
  const startOfNextYear = `${annee + 1}-01-01`;
  const startOfMonth = `${annee}-${String(mois + 1).padStart(2, "0")}-01`;
  const startOfNextMonth =
    mois === 11
      ? `${annee + 1}-01-01`
      : `${annee}-${String(mois + 2).padStart(2, "0")}-01`;
  const startOfPrevMonth =
    mois === 0
      ? `${annee - 1}-12-01`
      : `${annee}-${String(mois).padStart(2, "0")}-01`;
  // 12 mois glissants — bornes sûres même un 31 (lib/mois, testé)
  const moisGlissants = derniers12Mois(now);
  const start12moisAgo = moisGlissants[0]!.start;

  const trimestre = trimestreCourant(today);

  // Récupération en parallèle
  const [
    facturesAnneeRes,
    exportUrssafAnnee,
    exportUrssafTrimestre,
    exportUrssafMois,
    bareme,
    facturesEnvoyeesRes,
    devisEnvoyesRes,
    devisStatutsRes,
    facturesRecentesRes,
    devisRecentsRes,
    contratsRes,
    profilRes,
  ] = await Promise.all([
    // Factures ÉMISES sur 12 mois glissants (brouillons et annulées
    // exclus : un brouillon n'est pas émis, il ne doit pas gonfler le
    // « facturé » des cartes ni des graphes)
    supabase
      .from("factures")
      .select("id,numero,date_emission,date_echeance,total_ht,statut,type_activite,client_id,client:clients(id,nom)")
      .gte("date_emission", start12moisAgo)
      .lt("date_emission", startOfNextYear)
      .neq("statut", "annulee")
      .neq("statut", "brouillon"),
    // CA ENCAISSÉ de l'année pour les jauges de seuils micro — on
    // réutilise le calcul de l'export URSSAF (somme des paiements,
    // factures annulées exclues) pour avoir exactement le même chiffre
    // que la page Exports.
    buildExportUrssaf(startOfYear, startOfNextYear),
    // Encaissé du trimestre en cours + barème → provision de cotisations
    buildExportUrssaf(trimestre.start, trimestre.end),
    // Encaissé du mois courant (carte KPI trésorerie)
    buildExportUrssaf(startOfMonth, startOfNextMonth),
    getBaremeCotisations(),
    // Factures envoyées (= impayées) tous statuts
    supabase
      .from("factures")
      .select("id,numero,date_echeance,total_ht,client_id,client:clients(id,nom)")
      .eq("statut", "envoyee"),
    // Devis envoyés (en attente) — modèles exclus
    supabase
      .from("devis")
      .select("id,date_validite")
      .eq("statut", "envoye")
      .eq("est_modele", false),
    // Stats devis pour taux de conversion — modèles exclus
    supabase.from("devis").select("statut").eq("est_modele", false),
    // 5 factures les plus récentes
    supabase
      .from("factures")
      .select("id,numero,date_emission,total_ht,statut,client:clients(nom)")
      .order("date_emission", { ascending: false })
      .order("numero", { ascending: false })
      .limit(5),
    // 5 devis les plus récents — modèles exclus
    supabase
      .from("devis")
      .select("id,numero,date_emission,date_validite,total_ht,statut,client:clients(nom)")
      .eq("est_modele", false)
      .order("date_emission", { ascending: false })
      .order("numero", { ascending: false })
      .limit(5),
    // Prochaines visites maintenance dans 30 j
    supabase
      .from("contrats_maintenance")
      .select("id,prochaine_visite,intitule,client:clients(nom)")
      .eq("statut", "actif")
      .not("prochaine_visite", "is", null)
      .gte("prochaine_visite", today)
      .lte(
        "prochaine_visite",
        new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      )
      .order("prochaine_visite", { ascending: true })
      .limit(8),
    // Échéances des attestations (décennale, capacité fluides)
    supabase
      .from("profil_entreprise")
      .select("decennale_valide_jusquau, fluides_valide_jusquau")
      .maybeSingle(),
  ]);

  const facturesAnnee = (facturesAnneeRes.data ?? []) as Array<{
    id: string;
    numero: string;
    date_emission: string;
    date_echeance: string;
    total_ht: number;
    statut: string;
    type_activite: string;
    client_id: string;
    client: { id: string; nom: string } | null;
  }>;

  // Facturé du mois courant (factures émises : envoyées + payées)
  const caMois = facturesAnnee
    .filter(
      (f) =>
        f.date_emission >= startOfMonth && f.date_emission < startOfNextMonth,
    )
    .reduce((sum, f) => sum + Number(f.total_ht), 0);

  // CA mois précédent (pour comparaison potentielle)
  const caMoisPrecedent = facturesAnnee
    .filter(
      (f) =>
        f.date_emission >= startOfPrevMonth && f.date_emission < startOfMonth,
    )
    .reduce((sum, f) => sum + Number(f.total_ht), 0);

  // CA année courante (basé sur date_emission de l'année calendrier)
  const caAnnee = facturesAnnee
    .filter(
      (f) => f.date_emission >= startOfYear && f.date_emission < startOfNextYear,
    )
    .reduce((sum, f) => sum + Number(f.total_ht), 0);

  // CA encaissé de l'année (base URSSAF) pour les jauges de seuils micro.
  const caEncaisseAnnee = exportUrssafAnnee.total_encaisse;
  // Encaissé du mois courant — LE chiffre de trésorerie du quotidien
  // (même source que l'export URSSAF : somme des paiements datés du mois)
  const caEncaisseMois = exportUrssafMois.total_encaisse;

  // Cotisations à provisionner sur l'encaissé du trimestre en cours,
  // au barème applicable aujourd'hui (table taux_cotisations, ACRE puis
  // taux plein). Avertissement si une hausse arrive dans les 6 mois.
  const encaisseTrimestre = exportUrssafTrimestre.total_encaisse;
  const provision = provisionCotisations(encaisseTrimestre, bareme, today);
  const basculeInfo = prochaineBascule(bareme, today);
  const cotisations: DashboardData["cotisations"] = {
    trimestreLabel: trimestre.label,
    encaisseTrimestre,
    provision,
    bascule: basculeInfo
      ? {
          date: basculeInfo.date,
          tauxAvantPct: tauxTotalPct(basculeInfo.avant),
          tauxApresPct: tauxTotalPct(basculeInfo.apres),
        }
      : null,
  };

  // Factures impayées
  const facturesEnvoyees = (facturesEnvoyeesRes.data ?? []) as Array<{
    id: string;
    numero: string;
    date_echeance: string;
    total_ht: number;
    client_id: string;
    client: { id: string; nom: string } | null;
  }>;
  const nbFacturesImpayees = facturesEnvoyees.length;
  const montantImpaye = facturesEnvoyees.reduce(
    (sum, f) => sum + Number(f.total_ht),
    0,
  );

  // Factures en retard (= envoyees + échéance dépassée)
  const facturesEnRetard = facturesEnvoyees
    .filter((f) => f.date_echeance < today)
    .map((f) => ({
      id: f.id,
      numero: f.numero,
      date_echeance: f.date_echeance,
      total_ht: Number(f.total_ht),
      client_nom: f.client?.nom ?? null,
      joursRetard: Math.floor(
        (new Date(today).getTime() - new Date(f.date_echeance).getTime()) /
          (24 * 3600 * 1000),
      ),
    }))
    .sort((a, b) => b.joursRetard - a.joursRetard)
    .slice(0, 5);

  // Devis en attente + expirant
  const devisEnvoyes = (devisEnvoyesRes.data ?? []) as Array<{
    id: string;
    date_validite: string;
  }>;
  const nbDevisEnAttente = devisEnvoyes.length;

  // Devis qui expirent dans les 15 j
  const dans15Jours = new Date(Date.now() + 15 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);
  const devisExpirantBientotIds = devisEnvoyes
    .filter(
      (d) => d.date_validite >= today && d.date_validite <= dans15Jours,
    )
    .map((d) => d.id);

  let devisExpirantBientot: DashboardData["devisExpirantBientot"] = [];
  if (devisExpirantBientotIds.length > 0) {
    const { data } = await supabase
      .from("devis")
      .select("id,numero,date_validite,total_ht,client:clients(nom)")
      .in("id", devisExpirantBientotIds);
    devisExpirantBientot = ((data ?? []) as Array<{
      id: string;
      numero: string;
      date_validite: string;
      total_ht: number;
      client: { nom: string } | null;
    }>)
      .map((d) => ({
        id: d.id,
        numero: d.numero,
        date_validite: d.date_validite,
        total_ht: Number(d.total_ht),
        client_nom: d.client?.nom ?? null,
        joursAvantExpiration: Math.ceil(
          (new Date(d.date_validite).getTime() - new Date(today).getTime()) /
            (24 * 3600 * 1000),
        ),
      }))
      .sort((a, b) => a.joursAvantExpiration - b.joursAvantExpiration);
  }

  // Taux de conversion devis — helper pur testé (null si aucun devis
  // décidable, affiché « — » par la carte KPI).
  const devisStatuts = (devisStatutsRes.data ?? []) as Array<{
    statut: string;
  }>;
  const tauxConversionDevis = computeTauxConversionDevis(devisStatuts);

  // CA par mois (12 derniers) ventilé par type d'activité —
  // buckets calculés par lib/mois (le setMonth() d'origine dupliquait
  // des mois et en faisait disparaître quand on était un 31)
  const caParMois: DashboardData["caParMois"] = [];
  for (const mois of moisGlissants) {
    const facturesDuMois = facturesAnnee.filter(
      (f) => f.date_emission >= mois.start && f.date_emission < mois.end,
    );

    const bucket = {
      mois: mois.label,
      plomberie: 0,
      clim: 0,
      pac: 0,
      entretien: 0,
      depannage: 0,
      autre: 0,
      total: 0,
    };
    for (const f of facturesDuMois) {
      const m = Number(f.total_ht);
      bucket.total += m;
      switch (f.type_activite) {
        case "plomberie":
          bucket.plomberie += m;
          break;
        case "installation_clim":
          bucket.clim += m;
          break;
        case "installation_pac":
          bucket.pac += m;
          break;
        case "entretien":
          bucket.entretien += m;
          break;
        case "depannage":
          bucket.depannage += m;
          break;
        default:
          bucket.autre += m;
      }
    }
    caParMois.push(bucket);
  }

  // Répartition par activité (année en cours)
  const facturesAnneeCalendrier = facturesAnnee.filter(
    (f) => f.date_emission >= startOfYear,
  );
  const caParActiviteMap = new Map<string, number>();
  for (const f of facturesAnneeCalendrier) {
    caParActiviteMap.set(
      f.type_activite,
      (caParActiviteMap.get(f.type_activite) ?? 0) + Number(f.total_ht),
    );
  }
  const caParActivite = Array.from(caParActiviteMap.entries())
    .map(([activite, montant]) => ({
      activite,
      libelle:
        LABELS_TYPE_ACTIVITE[activite as keyof typeof LABELS_TYPE_ACTIVITE] ??
        activite,
      montant,
    }))
    .sort((a, b) => b.montant - a.montant);

  // Top 5 clients (année en cours)
  const clientsMap = new Map<
    string,
    { id: string; nom: string; total: number; nbFactures: number }
  >();
  for (const f of facturesAnneeCalendrier) {
    if (!f.client) continue;
    const existing = clientsMap.get(f.client.id);
    if (existing) {
      existing.total += Number(f.total_ht);
      existing.nbFactures += 1;
    } else {
      clientsMap.set(f.client.id, {
        id: f.client.id,
        nom: f.client.nom,
        total: Number(f.total_ht),
        nbFactures: 1,
      });
    }
  }
  const topClients = Array.from(clientsMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Recent factures / devis
  const facturesRecentes = ((facturesRecentesRes.data ?? []) as Array<{
    id: string;
    numero: string;
    date_emission: string;
    total_ht: number;
    statut: string;
    client: { nom: string } | null;
  }>).map((f) => ({
    id: f.id,
    numero: f.numero,
    date_emission: f.date_emission,
    total_ht: Number(f.total_ht),
    statut: f.statut,
    client_nom: f.client?.nom ?? null,
  }));

  const devisRecents = ((devisRecentsRes.data ?? []) as Array<{
    id: string;
    numero: string;
    date_emission: string;
    date_validite: string;
    total_ht: number;
    statut: string;
    client: { nom: string } | null;
  }>).map((d) => ({
    id: d.id,
    numero: d.numero,
    date_emission: d.date_emission,
    date_validite: d.date_validite,
    total_ht: Number(d.total_ht),
    statut: d.statut,
    client_nom: d.client?.nom ?? null,
  }));

  // Prochaines visites maintenance
  const prochainesVisitesMaintenance = ((contratsRes.data ?? []) as Array<{
    id: string;
    prochaine_visite: string;
    intitule: string | null;
    client: { nom: string } | null;
  }>).map((c) => ({
    id: c.id,
    prochaine_visite: c.prochaine_visite,
    intitule: c.intitule,
    client_nom: c.client?.nom ?? null,
  }));

  // Alertes de validité des attestations (logique testée dans
  // lib/attestations) — affichées 30 j avant l'échéance, rouge après.
  const attestations: DashboardData["attestations"] = [];
  const profilEcheances = profilRes.data;
  for (const [label, dateFin] of [
    ["Attestation décennale", profilEcheances?.decennale_valide_jusquau],
    [
      "Attestation de capacité fluides",
      profilEcheances?.fluides_valide_jusquau,
    ],
  ] as const) {
    const alerte = alerteValidite(dateFin, today);
    if (alerte && dateFin) {
      attestations.push({ label, dateFin, alerte });
    }
  }

  return {
    annee,
    caMois,
    caEncaisseMois,
    caAnnee,
    caMoisPrecedent,
    nbFacturesImpayees,
    montantImpaye,
    nbDevisEnAttente,
    tauxConversionDevis,
    caEncaisseAnnee,
    cotisations,
    caParMois,
    caParActivite,
    topClients,
    facturesRecentes,
    devisRecents,
    facturesEnRetard,
    devisExpirantBientot,
    prochainesVisitesMaintenance,
    attestations,
  };
}
