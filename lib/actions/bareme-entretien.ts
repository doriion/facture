"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  BAREME_PAR_DEFAUT,
  GROUPES_BAREME,
  arrondi,
  normaliserTranches,
  type BaremeEntretien,
  type GroupeBareme,
  type PosteBareme,
  type ReglagesBareme,
  type Tranche,
  type ZoneBareme,
} from "@/lib/bareme-entretien";
import { parseMoneyInput } from "@/lib/format";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const CHEMINS = ["/parametres/bareme-entretien", "/contrats/calculateur"];
function revalider() {
  for (const c of CHEMINS) revalidatePath(c);
}

function nombre(v: unknown, min = 0, max = 1_000_000): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseMoneyInput(v);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return arrondi(n);
}

function estGroupe(v: unknown): v is GroupeBareme {
  return typeof v === "string" && v in GROUPES_BAREME;
}

/** Code stable pour un nouveau poste / une nouvelle zone (jamais affiché). */
function codeNouveau(libelle: string): string {
  const base = libelle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `${base || "poste"}_${Date.now().toString(36)}`;
}

function tranchesDe(json: unknown): Tranche[] {
  const r = normaliserTranches(json);
  return r.ok ? r.valeur : [];
}

/**
 * Barème de l'utilisateur (postes, zones, réglages). Au premier accès,
 * insère le barème par défaut — celui du fichier d'origine, sans TVA —
 * que l'utilisateur ajuste ensuite dans Paramètres → Barème entretien.
 * Même patron que getBaremeCotisations (upsert : pas de doublon en cas
 * de deux chargements simultanés).
 */
export async function getBaremeEntretien(): Promise<BaremeEntretien> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return BAREME_PAR_DEFAUT;

  const [postesRes, zonesRes, reglagesRes] = await Promise.all([
    supabase.from("bareme_entretien_postes").select("*").order("ordre"),
    supabase.from("bareme_entretien_zones").select("*").order("ordre"),
    supabase.from("bareme_entretien_reglages").select("*").maybeSingle(),
  ]);

  let postesRows = postesRes.data ?? [];
  if (postesRows.length === 0) {
    const { data } = await supabase
      .from("bareme_entretien_postes")
      .upsert(
        BAREME_PAR_DEFAUT.postes.map((p) => ({ user_id: user.id, ...p })),
        { onConflict: "user_id,code" },
      )
      .select("*");
    postesRows = data ?? [];
  }

  let zonesRows = zonesRes.data ?? [];
  if (zonesRows.length === 0) {
    const { data } = await supabase
      .from("bareme_entretien_zones")
      .upsert(
        BAREME_PAR_DEFAUT.zones.map((z) => ({ user_id: user.id, ...z })),
        { onConflict: "user_id,code" },
      )
      .select("*");
    zonesRows = data ?? [];
  }

  let reglagesRow = reglagesRes.data;
  if (!reglagesRow) {
    const { data } = await supabase
      .from("bareme_entretien_reglages")
      .upsert({ user_id: user.id, ...BAREME_PAR_DEFAUT.reglages }, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();
    reglagesRow = data;
  }

  const postes: PosteBareme[] = postesRows
    .map((r) => ({
      id: r.id,
      code: r.code,
      groupe: (estGroupe(r.groupe) ? r.groupe : "split") as GroupeBareme,
      libelle: r.libelle,
      unite: r.unite,
      tranches: tranchesDe(r.tranches),
      ordre: r.ordre,
      actif: r.actif,
    }))
    .sort((a, b) => a.ordre - b.ordre);
  const zones: ZoneBareme[] = zonesRows
    .map((r) => ({
      id: r.id,
      code: r.code,
      libelle: r.libelle,
      distance_km: Number(r.distance_km),
      peage: Number(r.peage),
      temps_route_h: Number(r.temps_route_h),
      ordre: r.ordre,
      actif: r.actif,
    }))
    .sort((a, b) => a.ordre - b.ordre);
  const reglages: ReglagesBareme = reglagesRow
    ? { tarif_km: Number(reglagesRow.tarif_km), taux_horaire: Number(reglagesRow.taux_horaire) }
    : BAREME_PAR_DEFAUT.reglages;

  return { postes, zones, reglages };
}

export type PosteSaisi = {
  id?: string;
  groupe: string;
  libelle: string;
  unite: string;
  /** Tranches saisies : seuil et prix en texte (« 146,00 » accepté). */
  tranches: Array<{ a_partir_de: string | number; prix: string | number }>;
  actif: boolean;
};

/** Crée ou met à jour un poste du barème. */
export async function savePosteBaremeAction(input: PosteSaisi): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const libelle = input.libelle.trim();
  if (libelle.length === 0 || libelle.length > 120) {
    return { ok: false, error: "Le libellé est obligatoire (120 caractères max)." };
  }
  if (!estGroupe(input.groupe)) return { ok: false, error: "Catégorie inconnue." };
  const unite = input.unite.trim() || "unité";
  if (unite.length > 30) return { ok: false, error: "Unité trop longue (30 caractères max)." };

  // Les prix arrivent en texte FR (« 146,00 ») : convertis avant validation.
  const tranchesSaisies = input.tranches.map((t) => ({
    a_partir_de: nombre(t.a_partir_de, 1, 10_000),
    prix: nombre(t.prix, 0, 100_000),
  }));
  if (tranchesSaisies.some((t) => t.a_partir_de === null || t.prix === null)) {
    return { ok: false, error: "Chaque tranche a un seuil (entier ≥ 1) et un prix (≥ 0)." };
  }
  const tranches = normaliserTranches(tranchesSaisies);
  if (!tranches.ok) return { ok: false, error: tranches.error };

  const payload = {
    groupe: input.groupe,
    libelle,
    unite,
    tranches: tranches.valeur,
    actif: !!input.actif,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("bareme_entretien_postes")
      .update(payload)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: dernier } = await supabase
      .from("bareme_entretien_postes")
      .select("ordre")
      .order("ordre", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("bareme_entretien_postes").insert({
      user_id: user.id,
      code: codeNouveau(libelle),
      ordre: (dernier?.ordre ?? 0) + 10,
      ...payload,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalider();
  return { ok: true, data: undefined };
}

export async function deletePosteBaremeAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("bareme_entretien_postes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalider();
  return { ok: true, data: undefined };
}

export type ZoneSaisie = {
  id?: string;
  libelle: string;
  distance_km: string | number;
  peage: string | number;
  temps_route_h: string | number;
  actif: boolean;
};

/** Crée ou met à jour une zone de déplacement. */
export async function saveZoneBaremeAction(input: ZoneSaisie): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const libelle = input.libelle.trim();
  if (libelle.length === 0 || libelle.length > 120) {
    return { ok: false, error: "Le nom de la zone est obligatoire (120 caractères max)." };
  }
  const distance_km = nombre(input.distance_km, 0, 100_000) ?? (input.distance_km === "" ? 0 : null);
  const peage = nombre(input.peage, 0, 10_000) ?? (input.peage === "" ? 0 : null);
  const temps_route_h = nombre(input.temps_route_h, 0, 1_000) ?? (input.temps_route_h === "" ? 0 : null);
  if (distance_km === null || peage === null || temps_route_h === null) {
    return { ok: false, error: "Distance, péage et temps de route sont des nombres positifs ou nuls." };
  }

  const payload = {
    libelle,
    distance_km,
    peage,
    temps_route_h,
    actif: !!input.actif,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("bareme_entretien_zones")
      .update(payload)
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: derniere } = await supabase
      .from("bareme_entretien_zones")
      .select("ordre")
      .order("ordre", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("bareme_entretien_zones").insert({
      user_id: user.id,
      code: codeNouveau(libelle),
      ordre: (derniere?.ordre ?? 0) + 10,
      ...payload,
    });
    if (error) return { ok: false, error: error.message };
  }
  revalider();
  return { ok: true, data: undefined };
}

export async function deleteZoneBaremeAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.from("bareme_entretien_zones").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalider();
  return { ok: true, data: undefined };
}

/** Tarif au km et taux horaire du déplacement. */
export async function saveReglagesBaremeAction(input: {
  tarif_km: string | number;
  taux_horaire: string | number;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const tarif_km = nombre(input.tarif_km, 0, 100);
  const taux_horaire = nombre(input.taux_horaire, 0, 10_000);
  if (tarif_km === null || taux_horaire === null) {
    return { ok: false, error: "Tarif au km et taux horaire sont des montants positifs ou nuls." };
  }
  const { error } = await supabase
    .from("bareme_entretien_reglages")
    .upsert(
      { user_id: user.id, tarif_km, taux_horaire, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalider();
  return { ok: true, data: undefined };
}
