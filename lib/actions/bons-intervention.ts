"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { aujourdhuiParis } from "@/lib/dates";
import { buildBonInterventionEmail, sendEmail } from "@/lib/email";
import { coordonneesEmetteur, enseigneEmetteur, ligneePiedDePage } from "@/lib/devis-modele";
import { logoApplication } from "@/lib/logo-app";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";
import {
  BonInterventionPdf,
  type BonInterventionData,
  type BonPhoto,
  type BonSignature,
} from "@/components/interventions/bon-intervention-pdf";
import type { Database, Json } from "@/types/database";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type BonIntervention = {
  id: string;
  intervention_id: string;
  created_at: string;
  envoye_le: string | null;
  destinataire: string | null;
  url: string;
};

type Supabase = ReturnType<typeof createClient>;
type Client = Database["public"]["Tables"]["clients"]["Row"];
type Intervention = Database["public"]["Tables"]["interventions"]["Row"];
type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

/** Nombre maximal de photos embarquées (poids du PDF envoyé par email). */
const MAX_PHOTOS = 6;

async function dataUri(
  supabase: Supabase,
  bucket: string,
  path: string,
  mime: string,
): Promise<string | null> {
  try {
    const { data: blob } = await supabase.storage.from(bucket).download(path);
    if (!blob) return null;
    const buf = Buffer.from(await blob.arrayBuffer());
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function chargerSignature(
  supabase: Supabase,
  interventionId: string,
  role: "operateur" | "detenteur",
): Promise<BonSignature> {
  const { data: rows } = await supabase
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
    imageDataUrl: await dataUri(supabase, "signatures", sig.storage_path, "image/png"),
  };
}

/** Photos embarquables (JPEG/PNG uniquement : react-pdf ne lit pas le WebP/HEIC). */
async function chargerPhotos(supabase: Supabase, interventionId: string): Promise<BonPhoto[]> {
  const { data } = await supabase
    .from("intervention_photos")
    .select("storage_path, legende, moment, ordre")
    .eq("intervention_id", interventionId)
    .order("ordre", { ascending: true });
  const photos: BonPhoto[] = [];
  for (const p of data ?? []) {
    if (photos.length >= MAX_PHOTOS) break;
    const ext = p.storage_path.split(".").pop()?.toLowerCase() ?? "";
    const mime =
      ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
    if (!mime) continue;
    photos.push({
      legende: p.legende,
      moment: p.moment,
      imageDataUrl: await dataUri(supabase, "intervention-photos", p.storage_path, mime),
    });
  }
  return photos;
}

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

/** Données figées du bon (snapshot archivé avec le PDF). */
function construireDonnees(
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
  };
}

/**
 * Génère le bon d'intervention (PDF), l'archive dans le bucket privé
 * `bons` avec son snapshot, et l'envoie par email au client si demandé
 * (le PDF est joint ; l'envoi est tracé sur le bon). Renvoie une URL
 * signée pour ouverture immédiate.
 */
export async function genererBonInterventionAction(
  interventionId: string,
  options: { envoyer: boolean; messagePerso?: string },
): Promise<ActionResult<{ id: string; url: string; envoyeA: string | null }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: raw, error: lectureErr } = await supabase
    .from("interventions")
    .select("*, client:clients(*), facture:factures(numero)")
    .eq("id", interventionId)
    .maybeSingle();
  if (lectureErr) return { ok: false, error: lectureErr.message };
  if (!raw) return { ok: false, error: "Intervention introuvable." };
  type WithJoins = Intervention & { client: Client | null; facture: { numero: string } | null };
  const { client, facture, ...intervention } = raw as WithJoins;
  if (intervention.supprime_le) {
    return { ok: false, error: "Intervention dans la corbeille : restaurez-la d'abord." };
  }
  if (options.envoyer && !client?.email) {
    return {
      ok: false,
      error: "Le client n'a pas d'adresse email — renseignez-la sur sa fiche, ou générez le bon sans l'envoyer.",
    };
  }

  const [{ data: profil }, signatureOperateur, signatureClient, photos] = await Promise.all([
    supabase.from("profil_entreprise").select("*").eq("user_id", user.id).maybeSingle(),
    chargerSignature(supabase, interventionId, "operateur"),
    chargerSignature(supabase, interventionId, "detenteur"),
    chargerPhotos(supabase, interventionId),
  ]);

  let logoData: string | null = null;
  if (profil?.logo_url) {
    const ext = profil.logo_url.split(".").pop()?.toLowerCase();
    const mime =
      ext === "svg"
        ? "image/svg+xml"
        : ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "webp"
            ? "image/webp"
            : "image/png";
    logoData = await dataUri(supabase, "logos", profil.logo_url, mime);
  }
  logoData = logoData ?? (await logoApplication());

  const donnees = construireDonnees(intervention, client, profil, facture?.numero ?? null);

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(
      BonInterventionPdf({ data: donnees, photos, signatureOperateur, signatureClient, logoData }),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec du rendu PDF." };
  }

  const path = `${user.id}/${interventionId}/bon-${Date.now()}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("bons")
    .upload(path, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data: row, error: dbErr } = await supabase
    .from("intervention_bons")
    .insert({
      user_id: user.id,
      intervention_id: interventionId,
      storage_path: path,
      donnees: donnees as unknown as Json,
    })
    .select("id")
    .single();
  if (dbErr || !row) {
    await supabase.storage.from("bons").remove([path]);
    return { ok: false, error: dbErr?.message ?? "Erreur d'enregistrement." };
  }

  let envoyeA: string | null = null;
  if (options.envoyer && client?.email) {
    const expediteurNom =
      profil?.nom_commercial ||
      [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
      "Auto-entrepreneur";
    const email = buildBonInterventionEmail({
      clientNom: client.nom,
      expediteurNom,
      dateText: formatDateCourte(intervention.date_intervention),
      messagePerso: options.messagePerso,
    });
    const res = await sendEmail({
      to: client.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: profil?.email_pro ?? undefined,
      attachments: [
        {
          filename: `bon-intervention-${intervention.date_intervention}.pdf`,
          content: buffer,
          contentType: "application/pdf",
        },
      ],
    });
    if (!res.ok) {
      // Le bon est archivé mais pas envoyé : on le dit clairement, sans
      // tracer d'envoi.
      revalidatePath(`/interventions/${interventionId}`);
      return { ok: false, error: `Bon généré mais email non envoyé : ${res.error}` };
    }
    envoyeA = client.email;
    await supabase
      .from("intervention_bons")
      .update({ envoye_le: new Date().toISOString(), destinataire: client.email })
      .eq("id", row.id);
  }

  const { data: signed } = await supabase.storage.from("bons").createSignedUrl(path, 3600);

  revalidatePath(`/interventions/${interventionId}`);
  return { ok: true, data: { id: row.id, url: signed?.signedUrl ?? "", envoyeA } };
}

function formatDateCourte(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Bons archivés d'une intervention, avec URL signée (1 h). */
export async function listBonsIntervention(interventionId: string): Promise<BonIntervention[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("intervention_bons")
    .select("id, intervention_id, storage_path, created_at, envoye_le, destinataire")
    .eq("intervention_id", interventionId)
    .order("created_at", { ascending: false });
  if (!data || data.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from("bons")
    .createSignedUrls(
      data.map((d) => d.storage_path),
      3600,
    );
  const urlByPath = new Map<string, string>();
  for (const s of signed ?? []) {
    if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  }
  return data.map((d) => ({
    id: d.id,
    intervention_id: d.intervention_id,
    created_at: d.created_at,
    envoye_le: d.envoye_le,
    destinataire: d.destinataire,
    url: urlByPath.get(d.storage_path) ?? "",
  }));
}

/** Supprime un bon archivé (storage + base). Un bon envoyé ne se supprime pas. */
export async function deleteBonInterventionAction(id: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("intervention_bons")
    .select("id, intervention_id, storage_path, envoye_le")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Bon introuvable." };
  if (doc.envoye_le) {
    return { ok: false, error: "Ce bon a été envoyé au client : il est conservé comme trace." };
  }
  await supabase.storage.from("bons").remove([doc.storage_path]);
  const { error } = await supabase.from("intervention_bons").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/interventions/${doc.intervention_id}`);
  return { ok: true, data: undefined };
}
