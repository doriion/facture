"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  interventionSchema,
  type InterventionFormValues,
  deplacementInterventionSchema,
  type DeplacementIntervention,
  recurrenceSchema,
} from "@/lib/validations/intervention";
import {
  MAX_OCCURRENCES,
  datesOccurrences,
  depassePlafond,
  ecartJours,
  type PorteeSerie,
  type Recurrence,
} from "@/lib/agenda-recurrence";
import { ajouterJours } from "@/lib/agenda-vues";
import type { Database } from "@/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Intervention = Database["public"]["Tables"]["interventions"]["Row"];

/**
 * Liste des interventions, optionnellement filtrées par client/type/période.
 */
export async function listInterventions(params?: {
  search?: string;
  type?: string;
  client_id?: string;
}) {
  const supabase = createClient();
  let query = supabase
    .from("interventions")
    .select("*, client:clients(id, nom, type), facture:factures(id, numero)")
    .is("supprime_le", null)
    .order("date_intervention", { ascending: false });

  if (params?.search) {
    const s = `%${params.search}%`;
    query = query.or(
      `description.ilike.${s},equipement_marque.ilike.${s},equipement_modele.ilike.${s},equipement_num_serie.ilike.${s}`,
    );
  }
  if (params?.type && params.type !== "tous") {
    query = query.eq("type", params.type);
  }
  if (params?.client_id) {
    query = query.eq("client_id", params.client_id);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getIntervention(id: string): Promise<{
  intervention: Intervention | null;
  client: Database["public"]["Tables"]["clients"]["Row"] | null;
  facture: { id: string; numero: string; statut: string } | null;
}> {
  const supabase = createClient();
  const { data } = await supabase
    .from("interventions")
    .select("*, client:clients(*), facture:factures(id, numero, statut)")
    .eq("id", id)
    .maybeSingle();

  if (!data) return { intervention: null, client: null, facture: null };

  type WithJoins = NonNullable<typeof data> & {
    client: Database["public"]["Tables"]["clients"]["Row"] | null;
    facture: { id: string; numero: string; statut: string } | null;
  };
  const { client, facture, ...intervention } = data as WithJoins;
  return { intervention, client, facture };
}

/**
 * Bilan annuel des fluides frigorigènes manipulés (utile pour la
 * déclaration F-Gas et le rapport au client).
 */
export async function bilanFluidesFrigo(annee?: number) {
  const supabase = createClient();
  const year = annee ?? new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  const { data } = await supabase
    .from("interventions")
    .select(
      "fluide_frigo_type,fluide_frigo_kg_ajoute,fluide_frigo_kg_recupere",
    )
    .is("supprime_le", null)
    .gte("date_intervention", start)
    .lt("date_intervention", end);

  const bilan: Record<string, { ajoute: number; recupere: number }> = {};
  for (const row of data ?? []) {
    const fluide = row.fluide_frigo_type ?? "Inconnu";
    if (!bilan[fluide]) bilan[fluide] = { ajoute: 0, recupere: 0 };
    bilan[fluide].ajoute += Number(row.fluide_frigo_kg_ajoute ?? 0);
    bilan[fluide].recupere += Number(row.fluide_frigo_kg_recupere ?? 0);
  }
  return { annee: year, bilan };
}

/** Colonnes d'une intervention à partir du formulaire (création). */
function ligneIntervention(v: InterventionFormValues, userId: string) {
  return {
    user_id: userId,
    client_id: v.client_id || null,
    date_intervention: v.date_intervention,
    date_fin: v.date_fin || null,
    heure_debut: v.heure_debut || null,
    heure_fin: v.heure_fin || null,
    type: v.type,
    description: v.description || null,
    equipement_marque: v.equipement_marque || null,
    equipement_modele: v.equipement_modele || null,
    equipement_num_serie: v.equipement_num_serie || null,
    fluide_frigo_type: v.fluide_frigo_type || null,
    fluide_frigo_kg_ajoute: v.fluide_frigo_kg_ajoute,
    fluide_frigo_kg_recupere: v.fluide_frigo_kg_recupere,
    fluide_charge_totale_kg: v.fluide_charge_totale_kg,
    etancheite_controle: v.etancheite_controle ?? null,
    etancheite_detecteur: v.etancheite_detecteur || null,
    etancheite_detecteur_controle_le:
      v.etancheite_detecteur_controle_le || null,
    etancheite_fuite: v.etancheite_fuite ?? null,
    etancheite_fuite_localisation: v.etancheite_fuite_localisation || null,
    fluide_observations: v.fluide_observations || null,
    duree_minutes: v.duree_minutes,
    facture_id: v.facture_id ?? null,
    notes: v.notes || null,
    a_facturer: v.a_facturer ?? true,
  };
}

export async function createInterventionAction(
  values: InterventionFormValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = interventionSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data, error } = await supabase
    .from("interventions")
    .insert(ligneIntervention(v, user.id))
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Échec de la création." };
  }

  revalidatePath("/interventions");
  return { ok: true, data: { id: data.id } };
}

/**
 * Série de rendez-vous récurrents : une règle (interventions_series) et
 * une intervention ORDINAIRE par occurrence, toutes créées maintenant
 * (jusqu'à la date de fin, MAX_OCCURRENCES au plus). Chaque occurrence
 * se facture, se déplace ou se supprime comme n'importe quel rendez-vous.
 */
export async function createInterventionSerieAction(
  values: InterventionFormValues,
  recurrence: Recurrence,
): Promise<ActionResult<{ serie_id: string; ids: string[]; dates: string[] }>> {
  const parsed = interventionSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }
  const rec = recurrenceSchema.safeParse(recurrence);
  if (!rec.success) {
    return { ok: false, error: rec.error.issues[0]?.message ?? "Répétition invalide." };
  }
  const v = parsed.data;
  if (rec.data.date_fin < v.date_intervention) {
    return { ok: false, error: "La fin de la répétition précède le premier rendez-vous." };
  }
  if (depassePlafond(v.date_intervention, rec.data)) {
    return {
      ok: false,
      error: `Trop de rendez-vous (plus de ${MAX_OCCURRENCES}) : rapprochez la date de fin.`,
    };
  }
  const dates = datesOccurrences(v.date_intervention, rec.data);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: serie, error: erreurSerie } = await supabase
    .from("interventions_series")
    .insert({
      user_id: user.id,
      frequence: rec.data.frequence,
      intervalle: rec.data.intervalle,
      date_debut: v.date_intervention,
      date_fin: rec.data.date_fin,
    })
    .select("id")
    .single();
  if (erreurSerie || !serie) {
    return { ok: false, error: erreurSerie?.message ?? "Échec de la création de la série." };
  }

  // Une intervention sur plusieurs jours garde sa durée à chaque occurrence.
  const dureeJours = v.date_fin ? ecartJours(v.date_intervention, v.date_fin) : null;
  const base = ligneIntervention(v, user.id);
  const lignes = dates.map((d) => ({
    ...base,
    date_intervention: d,
    date_fin: dureeJours !== null && dureeJours > 0 ? ajouterJours(d, dureeJours) : null,
    serie_id: serie.id,
  }));
  const { data, error } = await supabase
    .from("interventions")
    .insert(lignes)
    .select("id, date_intervention")
    .order("date_intervention", { ascending: true });
  if (error || !data) {
    // Pas de série orpheline.
    await supabase.from("interventions_series").delete().eq("id", serie.id);
    return { ok: false, error: error?.message ?? "Échec de la création des rendez-vous." };
  }

  revalidatePath("/interventions");
  revalidatePath("/agenda");
  return {
    ok: true,
    data: { serie_id: serie.id, ids: data.map((r) => r.id), dates: data.map((r) => r.date_intervention) },
  };
}

export async function updateInterventionAction(
  id: string,
  values: InterventionFormValues,
): Promise<ActionResult> {
  const parsed = interventionSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const { error } = await supabase
    .from("interventions")
    .update({
      client_id: v.client_id || null,
      date_intervention: v.date_intervention,
      date_fin: v.date_fin || null,
      heure_debut: v.heure_debut || null,
      heure_fin: v.heure_fin || null,
      // Date ou heure modifiée : le rappel push est réarmé.
      rappel_push_envoye_le: null,
      type: v.type,
      description: v.description || null,
      equipement_marque: v.equipement_marque || null,
      equipement_modele: v.equipement_modele || null,
      equipement_num_serie: v.equipement_num_serie || null,
      fluide_frigo_type: v.fluide_frigo_type || null,
      fluide_frigo_kg_ajoute: v.fluide_frigo_kg_ajoute,
      fluide_frigo_kg_recupere: v.fluide_frigo_kg_recupere,
      fluide_charge_totale_kg: v.fluide_charge_totale_kg,
      etancheite_controle: v.etancheite_controle ?? null,
      etancheite_detecteur: v.etancheite_detecteur || null,
      etancheite_detecteur_controle_le:
        v.etancheite_detecteur_controle_le || null,
      etancheite_fuite: v.etancheite_fuite ?? null,
      etancheite_fuite_localisation: v.etancheite_fuite_localisation || null,
      fluide_observations: v.fluide_observations || null,
      duree_minutes: v.duree_minutes,
      facture_id: v.facture_id ?? null,
      notes: v.notes || null,
      a_facturer: v.a_facturer ?? true,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/interventions");
  revalidatePath(`/interventions/${id}`);
  return { ok: true, data: undefined };
}

/** Ids qui portent des signatures ou des fiches CERFA archivées (documents à conserver 5 ans). */
async function idsProteges(
  supabase: ReturnType<typeof createClient>,
  ids: string[],
): Promise<{ signatures: Set<string>; cerfa: Set<string> }> {
  const [sig, cerfa] = await Promise.all([
    supabase.from("intervention_signatures").select("intervention_id").in("intervention_id", ids),
    supabase.from("intervention_cerfa").select("intervention_id").in("intervention_id", ids),
  ]);
  return {
    signatures: new Set((sig.data ?? []).map((r) => r.intervention_id as string)),
    cerfa: new Set((cerfa.data ?? []).map((r) => r.intervention_id as string)),
  };
}

/** Ligne de la corbeille (interventions supprimées, restaurables). */
export type InterventionCorbeille = {
  id: string;
  date_intervention: string;
  date_fin: string | null;
  heure_debut: string | null;
  description: string | null;
  type: string;
  supprime_le: string;
  client_nom: string | null;
};

/** Corbeille : les interventions supprimées, les plus récentes d'abord. */
export async function listCorbeille(): Promise<InterventionCorbeille[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("interventions")
    .select("id, date_intervention, date_fin, heure_debut, description, type, supprime_le, client:clients(nom)")
    .not("supprime_le", "is", null)
    .order("supprime_le", { ascending: false })
    .limit(200);
  type Row = Omit<InterventionCorbeille, "client_nom"> & { client: { nom: string } | { nom: string }[] | null };
  return ((data ?? []) as Row[]).map((r) => {
    const c = Array.isArray(r.client) ? r.client[0] : r.client;
    return {
      id: r.id,
      date_intervention: r.date_intervention,
      date_fin: r.date_fin,
      heure_debut: r.heure_debut,
      description: r.description,
      type: r.type,
      supprime_le: r.supprime_le,
      client_nom: c?.nom ?? null,
    };
  });
}

/**
 * Suppression = MISE À LA CORBEILLE (horodatage `supprime_le`) : rien
 * n'est effacé, l'intervention se restaure d'un clic (« Annuler » ou
 * page Corbeille). Portée « suivantes » (série) : ce rendez-vous et
 * tous ceux de sa série à partir de cette date, sauf les facturés.
 * L'effacement réel : supprimerDefinitivementAction.
 */
export async function deleteInterventionAction(
  id: string,
  portee: PorteeSerie = "seule",
): Promise<ActionResult<{ supprimees: number; conservees: number; ids: string[] }>> {
  const supabase = createClient();

  let cibles: string[] = [id];
  if (portee === "suivantes") {
    const { data: orig } = await supabase
      .from("interventions")
      .select("serie_id, date_intervention")
      .eq("id", id)
      .maybeSingle();
    if (orig?.serie_id) {
      const { data: occs } = await supabase
        .from("interventions")
        .select("id")
        .eq("serie_id", orig.serie_id)
        .gte("date_intervention", orig.date_intervention)
        .is("facture_id", null)
        .is("supprime_le", null);
      cibles = (occs ?? []).map((o) => o.id);
      if (!cibles.includes(id)) cibles.push(id);
    }
  }

  const { data, error } = await supabase
    .from("interventions")
    .update({ supprime_le: new Date().toISOString() })
    .in("id", cibles)
    .is("supprime_le", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return { ok: false, error: "Intervention introuvable." };

  revalidatePath("/interventions");
  revalidatePath("/agenda");
  return { ok: true, data: { supprimees: ids.length, conservees: 0, ids } };
}

/** Sort une ou plusieurs interventions de la corbeille. */
export async function restaurerInterventionAction(
  ids: string | string[],
): Promise<ActionResult<{ restaurees: number }>> {
  const liste = Array.isArray(ids) ? ids : [ids];
  if (liste.length === 0) return { ok: true, data: { restaurees: 0 } };
  const supabase = createClient();
  const { data, error } = await supabase
    .from("interventions")
    .update({ supprime_le: null })
    .in("id", liste)
    .not("supprime_le", "is", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/interventions");
  revalidatePath("/interventions/corbeille");
  revalidatePath("/agenda");
  for (const id of liste) revalidatePath(`/interventions/${id}`);
  return { ok: true, data: { restaurees: (data ?? []).length } };
}

/**
 * Effacement RÉEL, depuis la corbeille ou la fiche. Une intervention
 * signée ou avec fiches CERFA archivées (documents à conserver 5 ans)
 * ne peut pas être effacée : la FK ON DELETE RESTRICT bloque de toute
 * façon en base, mais on renvoie une erreur claire.
 */
export async function supprimerDefinitivementAction(
  id: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const proteges = await idsProteges(supabase, [id]);
  if (proteges.signatures.has(id)) {
    return {
      ok: false,
      error:
        "Impossible d'effacer : cette intervention comporte des signatures (fiche d'intervention fluides à conserver 5 ans).",
    };
  }
  if (proteges.cerfa.has(id)) {
    return {
      ok: false,
      error:
        "Impossible d'effacer : des fiches CERFA sont archivées pour cette intervention. Supprimez d'abord les fiches archivées si elles sont obsolètes.",
    };
  }

  const { data: ligne } = await supabase
    .from("interventions")
    .select("serie_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("interventions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Série vide : on retire la règle (rien ne la référence plus).
  if (ligne?.serie_id) {
    const { count } = await supabase
      .from("interventions")
      .select("id", { count: "exact", head: true })
      .eq("serie_id", ligne.serie_id);
    if (!count) await supabase.from("interventions_series").delete().eq("id", ligne.serie_id);
  }

  revalidatePath("/interventions");
  revalidatePath("/interventions/corbeille");
  revalidatePath("/agenda");
  return { ok: true, data: undefined };
}

/**
 * Mise à jour partielle utilisée par le dialogue rapide depuis l'agenda :
 * ne touche que les champs édités (planning + métadonnées), préserve
 * équipement / fluides / notes / facture_id. À utiliser à la place de
 * updateInterventionAction quand seul le planning est modifié.
 *
 * Portée « suivantes » (série) : les mêmes changements s'appliquent à
 * ce rendez-vous et à tous ceux de la série à partir de cette date,
 * sauf les facturés. Un changement de date décale les suivants d'autant
 * (lundi → mardi : tous les lundis suivants passent au mardi).
 */
export async function quickEditInterventionAction(
  id: string,
  partial: {
    /** null = client à renseigner plus tard */
    client_id: string | null;
    date_intervention: string;
    date_fin: string | null;
    heure_debut: string | null;
    heure_fin: string | null;
    type: string;
    description: string | null;
    /** false = rien à facturer */
    a_facturer: boolean;
  },
  portee: PorteeSerie = "seule",
): Promise<ActionResult> {
  const supabase = createClient();
  const champs = {
    client_id: partial.client_id,
    heure_debut: partial.heure_debut,
    heure_fin: partial.heure_fin,
    type: partial.type,
    description: partial.description,
    a_facturer: partial.a_facturer,
    // Date ou heure modifiée : le rappel push est réarmé.
    rappel_push_envoye_le: null,
  };

  if (portee === "suivantes") {
    const { data: orig } = await supabase
      .from("interventions")
      .select("serie_id, date_intervention")
      .eq("id", id)
      .maybeSingle();
    if (orig?.serie_id) {
      const delta = ecartJours(orig.date_intervention, partial.date_intervention);
      const dureeJours = partial.date_fin
        ? ecartJours(partial.date_intervention, partial.date_fin)
        : null;
      const { data: occs, error: erreurLecture } = await supabase
        .from("interventions")
        .select("id, date_intervention")
        .eq("serie_id", orig.serie_id)
        .gte("date_intervention", orig.date_intervention)
        .is("facture_id", null)
        .is("supprime_le", null);
      if (erreurLecture) return { ok: false, error: erreurLecture.message };
      for (const occ of occs ?? []) {
        const date = occ.id === id ? partial.date_intervention : ajouterJours(occ.date_intervention, delta);
        const { error } = await supabase
          .from("interventions")
          .update({
            ...champs,
            date_intervention: date,
            date_fin: dureeJours !== null && dureeJours > 0 ? ajouterJours(date, dureeJours) : null,
          })
          .eq("id", occ.id);
        if (error) return { ok: false, error: error.message };
      }
      if (delta > 0) {
        // La règle suit : sa fin ne doit pas précéder la dernière occurrence.
        const { data: serie } = await supabase
          .from("interventions_series")
          .select("date_fin")
          .eq("id", orig.serie_id)
          .maybeSingle();
        if (serie) {
          await supabase
            .from("interventions_series")
            .update({ date_fin: ajouterJours(serie.date_fin, delta) })
            .eq("id", orig.serie_id);
        }
      }
      revalidatePath("/interventions");
      revalidatePath("/agenda");
      return { ok: true, data: undefined };
    }
  }

  const { error } = await supabase
    .from("interventions")
    .update({
      ...champs,
      date_intervention: partial.date_intervention,
      date_fin: partial.date_fin,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/interventions");
  revalidatePath(`/interventions/${id}`);
  revalidatePath("/agenda");
  return { ok: true, data: undefined };
}

/**
 * « Rien à facturer » / « à facturer » : bascule depuis l'agenda (panneau
 * À facturer, détail d'un évènement) sans toucher au reste de la fiche.
 */
export async function setInterventionAFacturerAction(
  id: string,
  aFacturer: boolean,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("interventions")
    .update({ a_facturer: aFacturer })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/interventions");
  revalidatePath(`/interventions/${id}`);
  revalidatePath("/agenda");
  return { ok: true, data: undefined };
}

/**
 * Déplacement par glisser-déposer depuis l'agenda : seul le planning
 * change (jour, jour de fin, heures). Refusé une fois la facture émise :
 * le planning se corrige alors depuis la fiche, pas d'un geste sur
 * l'agenda.
 */
export async function deplacerInterventionAction(
  id: string,
  valeurs: DeplacementIntervention,
): Promise<ActionResult> {
  const parsed = deplacementInterventionSchema.safeParse(valeurs);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Planning invalide." };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from("interventions")
    .update({
      date_intervention: parsed.data.date_intervention,
      date_fin: parsed.data.date_fin,
      heure_debut: parsed.data.heure_debut,
      heure_fin: parsed.data.heure_fin,
      // Rendez-vous déplacé : le rappel push est réarmé.
      rappel_push_envoye_le: null,
    })
    .eq("id", id)
    .is("facture_id", null)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "Intervention introuvable ou déjà facturée : modifiez-la depuis sa fiche.",
    };
  }
  revalidatePath("/interventions");
  revalidatePath(`/interventions/${id}`);
  revalidatePath("/agenda");
  return { ok: true, data: undefined };
}
