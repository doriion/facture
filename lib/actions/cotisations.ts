"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { BAREME_DEFAUT, type TauxCotisations } from "@/lib/cotisations";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type TauxCotisationsRow = TauxCotisations & { id: string };

/**
 * Barème de cotisations de l'utilisateur, trié par date d'effet.
 * Au premier accès (table vide), insère le barème par défaut — ACRE
 * puis taux plein au 01/04/2027 — que l'utilisateur ajuste ensuite
 * dans Paramètres.
 */
export async function getBaremeCotisations(): Promise<TauxCotisationsRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("taux_cotisations")
    .select("*")
    .order("date_debut", { ascending: true });

  if (data && data.length > 0) {
    return data.map(toRow);
  }

  // Seed silencieux du barème par défaut (upsert : ne double pas en
  // cas de course entre deux chargements simultanés).
  const { data: seeded } = await supabase
    .from("taux_cotisations")
    .upsert(
      BAREME_DEFAUT.map((t) => ({ user_id: user.id, ...t })),
      { onConflict: "user_id,date_debut" },
    )
    .select("*");

  return (seeded ?? [])
    .map(toRow)
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut));
}

function toRow(d: {
  id: string;
  date_debut: string;
  libelle: string;
  taux_social: number;
  taux_cfp: number;
  taux_vl: number;
}): TauxCotisationsRow {
  return {
    id: d.id,
    date_debut: d.date_debut,
    libelle: d.libelle,
    taux_social: Number(d.taux_social),
    taux_cfp: Number(d.taux_cfp),
    taux_vl: Number(d.taux_vl),
  };
}

/** Ajoute ou met à jour une ligne du barème (une par date d'effet). */
export async function saveTauxCotisationsAction(input: {
  id?: string;
  date_debut: string;
  libelle: string;
  taux_social: number | string;
  taux_cfp: number | string;
  taux_vl: number | string;
}): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const pct = (v: number | string): number | null => {
    const x =
      typeof v === "string" ? Number(v.replace(",", ".").trim()) : Number(v);
    if (!Number.isFinite(x) || x < 0 || x > 100) return null;
    return x;
  };
  const taux_social = pct(input.taux_social);
  const taux_cfp = pct(input.taux_cfp);
  const taux_vl = pct(input.taux_vl);
  if (taux_social === null || taux_cfp === null || taux_vl === null) {
    return { ok: false, error: "Taux invalide (0 à 100 %)." };
  }
  if (!input.date_debut) {
    return { ok: false, error: "Date d'effet obligatoire." };
  }

  const payload = {
    user_id: user.id,
    date_debut: input.date_debut,
    libelle: input.libelle.trim() || "Barème",
    taux_social,
    taux_cfp,
    taux_vl,
  };

  const { error } = input.id
    ? await supabase
        .from("taux_cotisations")
        .update(payload)
        .eq("id", input.id)
    : await supabase
        .from("taux_cotisations")
        .upsert(payload, { onConflict: "user_id,date_debut" });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}

export async function deleteTauxCotisationsAction(
  id: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("taux_cotisations")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  revalidatePath("/dashboard");
  return { ok: true, data: undefined };
}
