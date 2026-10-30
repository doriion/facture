import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildCerfaData } from "@/lib/cerfa";
import { cerfaOptionsDepuisFiche, interventionPourCerfa } from "@/lib/fiches-gaz";
import { construireDonneesBon } from "@/lib/bon-intervention-donnees";
import { logoApplication } from "@/lib/logo-app";
import type { CerfaSignature } from "@/components/interventions/cerfa-pdf";
import type { BonPhoto } from "@/components/interventions/bon-intervention-pdf";
import type { Database, Json } from "@/types/database";

/**
 * Documents d'une fiche gaz (CERFA 15497 + bon de réception), rendus et
 * archivés à partir d'un client Supabase quelconque : celui de
 * l'utilisateur (server actions, RLS) ou le service role (signature
 * publique du détenteur, sans session). Chaque requête filtre sur
 * l'intervention — et les écritures portent le user_id de l'intervention.
 */
export type Db = SupabaseClient<Database>;

type Intervention = Database["public"]["Tables"]["interventions"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

export type FicheChargee = {
  intervention: Intervention;
  client: Client | null;
  profil: Profil | null;
  factureNumero: string | null;
};

const MAX_PHOTOS = 6;

async function dataUri(db: Db, bucket: string, path: string, mime: string): Promise<string | null> {
  try {
    const { data: blob } = await db.storage.from(bucket).download(path);
    if (!blob) return null;
    return `data:${mime};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/** Intervention + client + profil de l'artisan + n° de facture éventuel. */
export async function chargerFiche(db: Db, interventionId: string): Promise<FicheChargee | null> {
  const { data: raw } = await db
    .from("interventions")
    .select("*, client:clients(*), facture:factures(numero)")
    .eq("id", interventionId)
    .maybeSingle();
  if (!raw) return null;
  type WithJoins = Intervention & { client: Client | null; facture: { numero: string } | null };
  const { client, facture, ...intervention } = raw as WithJoins;
  const { data: profil } = await db.from("profil_entreprise").select("*").eq("user_id", intervention.user_id).maybeSingle();
  return { intervention, client, profil: profil ?? null, factureNumero: facture?.numero ?? null };
}

/** Dernière signature d'un rôle, image embarquée en data URI. */
export async function chargerSignatureFiche(db: Db, interventionId: string, role: "operateur" | "detenteur"): Promise<CerfaSignature> {
  const { data: rows } = await db
    .from("intervention_signatures")
    .select("signataire_nom, signataire_qualite, storage_path, signe_le")
    .eq("intervention_id", interventionId)
    .eq("role", role)
    .order("signe_le", { ascending: false })
    .limit(1);
  const sig = rows?.[0];
  if (!sig) return null;
  return {
    nom: sig.signataire_nom,
    qualite: sig.signataire_qualite,
    date: sig.signe_le,
    imageDataUrl: await dataUri(db, "signatures", sig.storage_path, "image/png"),
  };
}

async function chargerPhotos(db: Db, interventionId: string): Promise<BonPhoto[]> {
  const { data } = await db
    .from("intervention_photos")
    .select("storage_path, legende, moment, ordre")
    .eq("intervention_id", interventionId)
    .order("ordre", { ascending: true });
  const photos: BonPhoto[] = [];
  for (const p of data ?? []) {
    if (photos.length >= MAX_PHOTOS) break;
    const ext = p.storage_path.split(".").pop()?.toLowerCase() ?? "";
    const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
    if (!mime) continue;
    photos.push({ legende: p.legende, moment: p.moment, imageDataUrl: await dataUri(db, "intervention-photos", p.storage_path, mime) });
  }
  return photos;
}

async function logoProfil(db: Db, profil: Profil | null): Promise<string | null> {
  if (profil?.logo_url) {
    const ext = profil.logo_url.split(".").pop()?.toLowerCase();
    const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
    const data = await dataUri(db, "logos", profil.logo_url, mime);
    if (data) return data;
  }
  return logoApplication();
}

/** Rendu du CERFA 15497 de la fiche (signatures du moment), sans archivage. */
export async function rendreCerfaFiche(db: Db, fiche: FicheChargee): Promise<Buffer> {
  const { intervention, client, profil } = fiche;
  const [signatureOperateur, signatureDetenteur] = await Promise.all([
    chargerSignatureFiche(db, intervention.id, "operateur"),
    chargerSignatureFiche(db, intervention.id, "detenteur"),
  ]);
  const data = buildCerfaData(interventionPourCerfa(intervention), client, profil, cerfaOptionsDepuisFiche(intervention));
  const [{ renderToBuffer }, { CerfaPdf }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/interventions/cerfa-pdf")]);
  return renderToBuffer(CerfaPdf({ data, signatureOperateur, signatureDetenteur }));
}

/** Rendu du bon de réception de la fiche (photos, signatures), sans archivage. */
export async function rendreBonFiche(db: Db, fiche: FicheChargee): Promise<Buffer> {
  const { intervention, client, profil, factureNumero } = fiche;
  const [signatureOperateur, signatureClient, photos, logoData] = await Promise.all([
    chargerSignatureFiche(db, intervention.id, "operateur"),
    chargerSignatureFiche(db, intervention.id, "detenteur"),
    chargerPhotos(db, intervention.id),
    logoProfil(db, profil),
  ]);
  const donnees = construireDonneesBon(intervention, client, profil, factureNumero);
  const [{ renderToBuffer }, { BonInterventionPdf }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/interventions/bon-intervention-pdf")]);
  return renderToBuffer(BonInterventionPdf({ data: donnees, photos, signatureOperateur, signatureClient, logoData }));
}

export type DocumentArchive = { id: string; path: string; buffer: Buffer };

/** CERFA rendu puis archivé (bucket `cerfa`, table intervention_cerfa). */
export async function archiverCerfaFiche(db: Db, fiche: FicheChargee): Promise<DocumentArchive> {
  const { intervention, client, profil } = fiche;
  const buffer = await rendreCerfaFiche(db, fiche);
  const data = buildCerfaData(interventionPourCerfa(intervention), client, profil, cerfaOptionsDepuisFiche(intervention));
  const path = `${intervention.user_id}/${intervention.id}/cerfa-15497-${Date.now()}.pdf`;
  const { error: uploadErr } = await db.storage.from("cerfa").upload(path, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) throw new Error(uploadErr.message);
  const { data: row, error } = await db
    .from("intervention_cerfa")
    .insert({ user_id: intervention.user_id, intervention_id: intervention.id, storage_path: path, donnees: data as unknown as Json })
    .select("id")
    .single();
  if (error || !row) {
    await db.storage.from("cerfa").remove([path]);
    throw new Error(error?.message ?? "Erreur d'enregistrement du CERFA.");
  }
  return { id: row.id, path, buffer };
}

/** Bon de réception rendu puis archivé (bucket `bons`, table intervention_bons). */
export async function archiverBonFiche(db: Db, fiche: FicheChargee): Promise<DocumentArchive> {
  const { intervention, client, profil, factureNumero } = fiche;
  const buffer = await rendreBonFiche(db, fiche);
  const donnees = construireDonneesBon(intervention, client, profil, factureNumero);
  const path = `${intervention.user_id}/${intervention.id}/bon-${Date.now()}.pdf`;
  const { error: uploadErr } = await db.storage.from("bons").upload(path, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) throw new Error(uploadErr.message);
  const { data: row, error } = await db
    .from("intervention_bons")
    .insert({ user_id: intervention.user_id, intervention_id: intervention.id, storage_path: path, donnees: donnees as unknown as Json })
    .select("id")
    .single();
  if (error || !row) {
    await db.storage.from("bons").remove([path]);
    throw new Error(error?.message ?? "Erreur d'enregistrement du bon.");
  }
  return { id: row.id, path, buffer };
}

/** Pièces jointes des deux documents, nommées pour le client. */
export function piecesJointesFiche(fiche: FicheChargee, cerfa: Buffer, bon: Buffer) {
  const date = fiche.intervention.date_intervention;
  const num = fiche.intervention.fiche_numero ? `-${fiche.intervention.fiche_numero}` : "";
  return [
    { filename: `cerfa-15497${num}-${date}.pdf`, content: cerfa, contentType: "application/pdf" },
    { filename: `bon-reception${num}-${date}.pdf`, content: bon, contentType: "application/pdf" },
  ];
}
