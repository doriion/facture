"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import {
  NATURES_INTERVENTION,
  buildCerfaData,
  type CerfaOptions,
  type NatureIntervention,
} from "@/lib/cerfa";
import {
  CerfaPdf,
  type CerfaSignature,
} from "@/components/interventions/cerfa-pdf";
import type { Database, Json } from "@/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type CerfaDocument = {
  id: string;
  intervention_id: string;
  storage_path: string;
  created_at: string;
  url: string;
};

/** Nettoie les options venues du client (types + bornes). */
function sanitizeOptions(raw: CerfaOptions): CerfaOptions {
  const kg = (v: unknown): number | null => {
    const x = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
    return Number.isFinite(x) && x >= 0 && x <= 10000 ? x : null;
  };
  const txt = (v: unknown, max = 300): string =>
    typeof v === "string" ? v.trim().slice(0, max) : "";
  return {
    ficheNumero: txt(raw.ficheNumero, 60),
    natures: (Array.isArray(raw.natures) ? raw.natures : []).filter(
      (nat): nat is NatureIntervention => nat in NATURES_INTERVENTION,
    ),
    systemePermanentDetection: raw.systemePermanentDetection === true,
    chargeViergeKg: kg(raw.chargeViergeKg),
    chargeRecycleKg: kg(raw.chargeRecycleKg),
    chargeRegenereKg: kg(raw.chargeRegenereKg),
    recupereTraitementKg: kg(raw.recupereTraitementKg),
    recupereReutilisationKg: kg(raw.recupereReutilisationKg),
    dechets: raw.dechets
      ? {
          codeUn: txt(raw.dechets.codeUn),
          contenants: txt(raw.dechets.contenants),
          numeroBsff: txt(raw.dechets.numeroBsff),
          destinationNom: txt(raw.dechets.destinationNom),
          destinationAdresse: txt(raw.dechets.destinationAdresse),
        }
      : null,
  };
}

/**
 * Dernière signature de chaque rôle, convertie en data URI pour être
 * embarquée dans le PDF (même approche que le logo des factures).
 */
async function loadSignature(
  supabase: ReturnType<typeof createClient>,
  interventionId: string,
  role: "operateur" | "detenteur",
): Promise<CerfaSignature> {
  const { data: rows } = await supabase
    .from("intervention_signatures")
    .select("signataire_nom, signataire_qualite, storage_path, signe_le")
    .eq("intervention_id", interventionId)
    .eq("role", role)
    .order("signe_le", { ascending: false })
    .limit(1);
  const sig = rows?.[0];
  if (!sig) return null;

  let imageDataUrl: string | null = null;
  try {
    const { data: blob } = await supabase.storage
      .from("signatures")
      .download(sig.storage_path);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      imageDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {
    imageDataUrl = null; // PDF rendu sans l'image, méta conservées
  }

  return {
    nom: sig.signataire_nom,
    qualite: sig.signataire_qualite,
    date: sig.signe_le,
    imageDataUrl,
  };
}

/**
 * Génère la fiche d'intervention (trame CERFA 15497*04) pré-remplie,
 * l'archive dans le bucket privé `cerfa` et enregistre l'entrée avec
 * un snapshot des données. Renvoie une URL signée pour ouverture
 * immédiate.
 */
export async function genererCerfaAction(
  interventionId: string,
  rawOptions: CerfaOptions,
): Promise<ActionResult<{ id: string; url: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const options = sanitizeOptions(rawOptions);

  const { data: interventionRaw } = await supabase
    .from("interventions")
    .select("*, client:clients(*)")
    .eq("id", interventionId)
    .maybeSingle();
  if (!interventionRaw) {
    return { ok: false, error: "Intervention introuvable." };
  }
  type WithClient = NonNullable<typeof interventionRaw> & {
    client: Database["public"]["Tables"]["clients"]["Row"] | null;
  };
  const { client, ...intervention } = interventionRaw as WithClient;

  const { data: profil } = await supabase
    .from("profil_entreprise")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const [signatureOperateur, signatureDetenteur] = await Promise.all([
    loadSignature(supabase, interventionId, "operateur"),
    loadSignature(supabase, interventionId, "detenteur"),
  ]);

  const data = buildCerfaData(intervention, client, profil, options);

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(
      CerfaPdf({ data, signatureOperateur, signatureDetenteur }),
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Échec du rendu PDF.",
    };
  }

  const path = `${user.id}/${interventionId}/cerfa-15497-${Date.now()}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("cerfa")
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data: row, error: dbErr } = await supabase
    .from("intervention_cerfa")
    .insert({
      user_id: user.id,
      intervention_id: interventionId,
      storage_path: path,
      donnees: data as unknown as Json,
    })
    .select("id")
    .single();
  if (dbErr || !row) {
    await supabase.storage.from("cerfa").remove([path]);
    return { ok: false, error: dbErr?.message ?? "Erreur enregistrement." };
  }

  const { data: signed } = await supabase.storage
    .from("cerfa")
    .createSignedUrl(path, 3600);

  revalidatePath(`/interventions/${interventionId}`);
  return { ok: true, data: { id: row.id, url: signed?.signedUrl ?? "" } };
}

/**
 * Liste les CERFA archivés d'une intervention avec URL signée (1 h).
 */
export async function listCerfaDocuments(
  interventionId: string,
): Promise<CerfaDocument[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("intervention_cerfa")
    .select("id, intervention_id, storage_path, created_at")
    .eq("intervention_id", interventionId)
    .order("created_at", { ascending: false });
  if (!data || data.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from("cerfa")
    .createSignedUrls(
      data.map((d) => d.storage_path),
      3600,
    );
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  }

  return data.map((d) => ({
    ...d,
    url: urlByPath.get(d.storage_path) ?? "",
  }));
}

/**
 * Supprime un CERFA archivé (storage + base). Les signatures restent
 * immuables — seul le PDF régénérable est géré ici.
 */
export async function deleteCerfaAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("intervention_cerfa")
    .select("storage_path, intervention_id")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Document introuvable." };

  await supabase.storage.from("cerfa").remove([doc.storage_path]);
  const { error } = await supabase
    .from("intervention_cerfa")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/interventions/${doc.intervention_id}`);
  return { ok: true, data: undefined };
}
