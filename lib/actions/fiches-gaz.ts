"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { formatDateFr } from "@/lib/format";
import {
  descriptionDepuisFiche,
  ficheGazSchema,
  libelleEquipement,
  numeroFiche,
  prefillDepuisDevis,
  prefillDepuisIntervention,
  totauxManipulations,
  typeInterventionDepuisNatures,
  type FicheGazInput,
  type FichePrefill,
} from "@/lib/fiches-gaz";
import { naturesParDefaut } from "@/lib/cerfa";
import {
  archiverBonFiche,
  archiverCerfaFiche,
  chargerFiche,
  piecesJointesFiche,
  type Db,
} from "@/lib/fiches-gaz/documents";
import { buildFicheGazEmail, buildSignatureFicheEmail, sendEmail, signatureDepuisProfil } from "@/lib/email";
import { baseUrlPublique } from "@/lib/url-publique";
import { nomExpediteur } from "@/lib/visites/proposer";
import type { Database, Json } from "@/types/database";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

type Intervention = Database["public"]["Tables"]["interventions"]["Row"];

/** Validité du lien de signature envoyé au client. */
const VALIDITE_LIEN_JOURS = 30;

export type FicheGazResume = {
  id: string;
  date_intervention: string;
  fiche_numero: string | null;
  fluide_frigo_type: string | null;
  fluide_charge_totale_kg: number | null;
  equipement_type: string | null;
  equipement_marque: string | null;
  equipement_repere: string | null;
  natures_cerfa: string[];
  bon_reserves: string | null;
  signature_demandee_le: string | null;
  client: { id: string; nom: string; ville: string | null } | null;
  detenteurSigne: boolean;
  cerfaUrl: string | null;
  bonUrl: string | null;
};

/** Fiches gaz de l'utilisateur (hors corbeille), les plus récentes d'abord. */
export async function listFichesGaz(): Promise<FicheGazResume[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("interventions")
    .select(
      "id, date_intervention, fiche_numero, fluide_frigo_type, fluide_charge_totale_kg, equipement_type, equipement_marque, equipement_repere, natures_cerfa, bon_reserves, signature_demandee_le, client:clients(id, nom, ville)",
    )
    .eq("est_fiche_gaz", true)
    .is("supprime_le", null)
    .order("date_intervention", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(300);
  const fiches = (data ?? []) as unknown as Array<Omit<FicheGazResume, "detenteurSigne" | "cerfaUrl" | "bonUrl">>;
  if (fiches.length === 0) return [];
  const ids = fiches.map((f) => f.id);

  const [{ data: signatures }, { data: cerfas }, { data: bons }] = await Promise.all([
    supabase.from("intervention_signatures").select("intervention_id").eq("role", "detenteur").in("intervention_id", ids),
    supabase.from("intervention_cerfa").select("intervention_id, storage_path, created_at").in("intervention_id", ids).order("created_at", { ascending: false }),
    supabase.from("intervention_bons").select("intervention_id, storage_path, created_at").in("intervention_id", ids).order("created_at", { ascending: false }),
  ]);
  const signes = new Set((signatures ?? []).map((s) => s.intervention_id));
  const dernier = (rows: Array<{ intervention_id: string; storage_path: string }> | null) => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) if (!m.has(r.intervention_id)) m.set(r.intervention_id, r.storage_path);
    return m;
  };
  const dernierCerfa = dernier(cerfas);
  const dernierBon = dernier(bons);
  const urls = async (bucket: "cerfa" | "bons", paths: string[]) => {
    const m = new Map<string, string>();
    if (paths.length === 0) return m;
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) m.set(s.path, s.signedUrl);
    return m;
  };
  const [urlsCerfa, urlsBon] = await Promise.all([urls("cerfa", [...dernierCerfa.values()]), urls("bons", [...dernierBon.values()])]);

  return fiches.map((f) => ({
    ...f,
    fluide_charge_totale_kg: f.fluide_charge_totale_kg !== null ? Number(f.fluide_charge_totale_kg) : null,
    natures_cerfa: f.natures_cerfa ?? [],
    detenteurSigne: signes.has(f.id),
    cerfaUrl: urlsCerfa.get(dernierCerfa.get(f.id) ?? "") ?? null,
    bonUrl: urlsBon.get(dernierBon.get(f.id) ?? "") ?? null,
  }));
}

function texteOuNull(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

/** Colonnes d'intervention écrites à partir de la saisie de la fiche. */
function colonnesFiche(v: ReturnType<typeof ficheGazSchema.parse>) {
  const totaux = totauxManipulations(v.fluide_manipulations);
  const controle =
    Boolean(texteOuNull(v.etancheite_detecteur)) ||
    v.natures_cerfa.includes("controle_periodique") ||
    v.natures_cerfa.includes("controle_non_periodique") ||
    v.etancheite_fuite === true;
  return {
    client_id: v.client_id,
    date_intervention: v.date_intervention,
    type: typeInterventionDepuisNatures(v.natures_cerfa),
    description: descriptionDepuisFiche({ bon_objet: v.bon_objet, natures_cerfa: v.natures_cerfa, equipement_type: v.equipement_type ?? null }),
    est_fiche_gaz: true,
    natures_cerfa: v.natures_cerfa,
    nature_autre: texteOuNull(v.nature_autre),
    equipement_type: v.equipement_type ?? null,
    equipement_marque: texteOuNull(v.equipement_marque),
    equipement_repere: texteOuNull(v.equipement_repere),
    equipement_modele: texteOuNull(v.equipement_modele),
    equipement_num_serie: texteOuNull(v.equipement_num_serie),
    fluide_frigo_type: texteOuNull(v.fluide_frigo_type),
    fluide_charge_totale_kg: v.fluide_charge_totale_kg,
    fluide_manipulations: v.fluide_manipulations as unknown as Json,
    fluide_frigo_kg_ajoute: totaux.ajoute > 0 ? totaux.ajoute : null,
    fluide_frigo_kg_recupere: totaux.recupere > 0 ? totaux.recupere : null,
    etancheite_controle: controle ? true : null,
    etancheite_detecteur: texteOuNull(v.etancheite_detecteur),
    etancheite_detecteur_controle_le: texteOuNull(v.etancheite_detecteur_controle_le),
    detection_permanente: v.detection_permanente,
    etancheite_fuite: controle ? v.etancheite_fuite ?? false : null,
    etancheite_fuite_localisation: v.etancheite_fuite ? texteOuNull(v.etancheite_fuite_localisation) : null,
    fuite_reparation: v.etancheite_fuite ? v.fuite_reparation ?? null : null,
    fluide_observations: texteOuNull(v.fluide_observations),
    dechets_bsff: texteOuNull(v.dechets_bsff),
    dechets_contenants: texteOuNull(v.dechets_contenants),
    dechets_destination: texteOuNull(v.dechets_destination),
    bon_devis_numero: texteOuNull(v.bon_devis_numero),
    bon_objet: texteOuNull(v.bon_objet),
    bon_reserves: v.bon_reserves ?? null,
    bon_reserves_texte: v.bon_reserves === "avec" ? texteOuNull(v.bon_reserves_texte) : null,
  };
}

/**
 * Crée (id null) ou met à jour la fiche gaz : une intervention ordinaire
 * marquée `est_fiche_gaz`, donc visible dans l'agenda et facturable
 * comme les autres. Le n° de fiche (AAMMJJ, -2, -3… dans la journée)
 * est attribué à la création et ne change plus.
 */
export async function enregistrerFicheGazAction(
  id: string | null,
  values: FicheGazInput,
): Promise<ActionResult<{ id: string; fiche_numero: string | null }>> {
  const parsed = ficheGazSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  const colonnes = colonnesFiche(parsed.data);

  if (id) {
    const { data, error } = await supabase
      .from("interventions")
      .update(colonnes)
      .eq("id", id)
      .eq("est_fiche_gaz", true)
      .select("id, fiche_numero")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Fiche introuvable." };
    revalidatePath("/fiches-gaz");
    revalidatePath(`/fiches-gaz/${id}`);
    revalidatePath("/interventions");
    revalidatePath("/agenda");
    return { ok: true, data: { id: data.id, fiche_numero: data.fiche_numero } };
  }

  const { count } = await supabase
    .from("interventions")
    .select("id", { count: "exact", head: true })
    .eq("est_fiche_gaz", true)
    .eq("date_intervention", parsed.data.date_intervention);
  const fiche_numero = numeroFiche(parsed.data.date_intervention, (count ?? 0) + 1);
  const { data, error } = await supabase
    .from("interventions")
    .insert({ ...colonnes, user_id: user.id, fiche_numero, a_facturer: true })
    .select("id, fiche_numero")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Échec de la création." };
  revalidatePath("/fiches-gaz");
  revalidatePath("/interventions");
  revalidatePath("/agenda");
  return { ok: true, data: { id: data.id, fiche_numero: data.fiche_numero } };
}

/** Détecteurs déjà saisis (avec leur dernier contrôle) pour les reprendre d'un tap. */
export async function detecteursConnus(): Promise<Array<{ nom: string; controle_le: string | null }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("interventions")
    .select("etancheite_detecteur, etancheite_detecteur_controle_le")
    .not("etancheite_detecteur", "is", null)
    .order("date_intervention", { ascending: false })
    .limit(200);
  const vus = new Map<string, string | null>();
  for (const r of data ?? []) {
    const nom = (r.etancheite_detecteur ?? "").trim();
    if (nom && !vus.has(nom)) vus.set(nom, r.etancheite_detecteur_controle_le);
  }
  return [...vus.entries()].map(([nom, controle_le]) => ({ nom, controle_le }));
}

async function ficheDeLUtilisateur(supabase: Db, id: string) {
  const fiche = await chargerFiche(supabase, id);
  if (!fiche || !fiche.intervention.est_fiche_gaz) return null;
  if (fiche.intervention.supprime_le) return null;
  return fiche;
}

/**
 * Génère et archive le CERFA 15497 et le bon de réception, et les
 * envoie au client en une seule pièce jointe double si demandé.
 */
export async function genererDocumentsFicheAction(
  id: string,
  options: { envoyer: boolean; messagePerso?: string },
): Promise<ActionResult<{ cerfaUrl: string; bonUrl: string; envoyeA: string | null }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  const fiche = await ficheDeLUtilisateur(supabase, id);
  if (!fiche) return { ok: false, error: "Fiche introuvable (ou dans la corbeille)." };
  if (options.envoyer && !fiche.client?.email) {
    return { ok: false, error: "Le client n'a pas d'adresse e-mail — renseignez-la sur sa fiche, ou générez les documents sans les envoyer." };
  }

  let cerfa, bon;
  try {
    cerfa = await archiverCerfaFiche(supabase, fiche);
    bon = await archiverBonFiche(supabase, fiche);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec du rendu PDF." };
  }

  let envoyeA: string | null = null;
  if (options.envoyer && fiche.client?.email) {
    const expediteurNom = nomExpediteur(fiche.profil);
    const email = buildFicheGazEmail({
      clientNom: fiche.client.nom,
      expediteurNom,
      dateText: formatDateFr(fiche.intervention.date_intervention),
      ficheNumero: fiche.intervention.fiche_numero,
      equipementText: libelleEquipement(fiche.intervention),
      messagePerso: options.messagePerso?.trim() || undefined,
      signature: signatureDepuisProfil(fiche.profil, expediteurNom),
    });
    const res = await sendEmail({
      to: fiche.client.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: fiche.profil?.email_pro ?? undefined,
      fromName: expediteurNom,
      attachments: piecesJointesFiche(fiche, cerfa.buffer, bon.buffer),
    });
    if (!res.ok) {
      revalidatePath(`/fiches-gaz/${id}`);
      return { ok: false, error: `Documents générés mais e-mail non envoyé : ${res.error}` };
    }
    envoyeA = fiche.client.email;
    await supabase.from("intervention_bons").update({ envoye_le: new Date().toISOString(), destinataire: envoyeA }).eq("id", bon.id);
  }

  const [{ data: urlCerfa }, { data: urlBon }] = await Promise.all([
    supabase.storage.from("cerfa").createSignedUrl(cerfa.path, 3600),
    supabase.storage.from("bons").createSignedUrl(bon.path, 3600),
  ]);
  revalidatePath(`/fiches-gaz/${id}`);
  revalidatePath(`/interventions/${id}`);
  revalidatePath("/fiches-gaz");
  return { ok: true, data: { cerfaUrl: urlCerfa?.signedUrl ?? "", bonUrl: urlBon?.signedUrl ?? "", envoyeA } };
}

/**
 * Lien de signature en ligne pour le détenteur : jeton unique (30 jours),
 * e-mail d'invitation si le client a une adresse, et dans tous les cas
 * le lien à transmettre soi-même (SMS, WhatsApp). Un lien encore
 * valable est réutilisé : renvoyer l'e-mail ne casse pas le précédent.
 */
export async function demanderSignatureFicheAction(
  id: string,
  options: { envoyer: boolean } = { envoyer: true },
): Promise<ActionResult<{ lien: string; envoyeA: string | null; expireLe: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  const fiche = await ficheDeLUtilisateur(supabase, id);
  if (!fiche) return { ok: false, error: "Fiche introuvable (ou dans la corbeille)." };
  if (!fiche.client) return { ok: false, error: "Choisissez le client de la fiche avant de demander sa signature." };
  const { data: deja } = await supabase.from("intervention_signatures").select("id").eq("intervention_id", id).eq("role", "detenteur").limit(1);
  if (deja && deja.length > 0) return { ok: false, error: "Le détenteur a déjà signé cette fiche." };
  if (options.envoyer && !fiche.client.email) {
    return { ok: false, error: "Le client n'a pas d'adresse e-mail : renseignez-la sur sa fiche, ou copiez le lien pour l'envoyer vous-même." };
  }

  const nowIso = new Date().toISOString();
  let token = fiche.intervention.signature_token;
  let expire = fiche.intervention.signature_token_expires_at;
  if (!token || !expire || expire <= nowIso) {
    token = randomBytes(32).toString("base64url");
    expire = new Date(Date.now() + VALIDITE_LIEN_JOURS * 24 * 3600 * 1000).toISOString();
  }
  const { error } = await supabase
    .from("interventions")
    .update({ signature_token: token, signature_token_expires_at: expire, signature_demandee_le: nowIso })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const lien = `${await baseUrlPublique()}/f/${token}`;
  let envoyeA: string | null = null;
  if (options.envoyer && fiche.client.email) {
    const expediteurNom = nomExpediteur(fiche.profil);
    const email = buildSignatureFicheEmail({
      clientNom: fiche.client.nom,
      expediteurNom,
      dateText: formatDateFr(fiche.intervention.date_intervention),
      ficheNumero: fiche.intervention.fiche_numero,
      equipementText: libelleEquipement(fiche.intervention),
      lien,
      expireLeText: formatDateFr(expire.slice(0, 10)),
      signature: signatureDepuisProfil(fiche.profil, expediteurNom),
    });
    const res = await sendEmail({
      to: fiche.client.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: fiche.profil?.email_pro ?? undefined,
      fromName: expediteurNom,
    });
    if (!res.ok) return { ok: false, error: `Lien créé mais e-mail non envoyé : ${res.error}` };
    envoyeA = fiche.client.email;
  }
  revalidatePath(`/fiches-gaz/${id}`);
  revalidatePath("/fiches-gaz");
  return { ok: true, data: { lien, envoyeA, expireLe: expire } };
}

/** Fiche à ouvrir : intervention marquée fiche gaz, sinon null. */
export async function getFicheGaz(id: string): Promise<{
  intervention: Intervention | null;
  client: Database["public"]["Tables"]["clients"]["Row"] | null;
  factureNumero: string | null;
  lienSignature: string | null;
}> {
  const supabase = await createClient();
  const fiche = await chargerFiche(supabase, id);
  if (!fiche || !fiche.intervention.est_fiche_gaz) return { intervention: null, client: null, factureNumero: null, lienSignature: null };
  const it = fiche.intervention;
  const lienSignature =
    it.signature_token && it.signature_token_expires_at && it.signature_token_expires_at > new Date().toISOString()
      ? `${await baseUrlPublique()}/f/${it.signature_token}`
      : null;
  return { intervention: it, client: fiche.client, factureNumero: fiche.factureNumero, lienSignature };
}

/**
 * Valeurs proposées pour une nouvelle fiche : d'après une fiche ou une
 * intervention précédente (?source=, nouvelle visite sur le même
 * matériel) ou d'après un devis (?devis=, mise en service). Sinon rien.
 */
export async function prefillFicheGaz(params: { source?: string; devis?: string }): Promise<FichePrefill> {
  const uuid = /^[0-9a-f-]{36}$/i;
  const supabase = await createClient();
  if (params.source && uuid.test(params.source)) {
    const { data } = await supabase.from("interventions").select("*").eq("id", params.source).maybeSingle();
    if (data) return prefillDepuisIntervention(data);
  }
  if (params.devis && uuid.test(params.devis)) {
    const { data } = await supabase.from("devis").select("client_id, numero, type_activite, equipement_info").eq("id", params.devis).maybeSingle();
    if (data) return prefillDepuisDevis(data);
  }
  return {};
}

/**
 * Transforme une intervention ordinaire en fiche gaz, sans la dupliquer
 * (même rendez-vous dans l'agenda, même facture) : n° de fiche attribué,
 * natures proposées d'après le type d'intervention.
 */
export async function convertirEnFicheGazAction(interventionId: string): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  const { data: it } = await supabase.from("interventions").select("id, est_fiche_gaz, fiche_numero, date_intervention, type, etancheite_controle, supprime_le").eq("id", interventionId).maybeSingle();
  if (!it) return { ok: false, error: "Intervention introuvable." };
  if (it.supprime_le) return { ok: false, error: "Intervention dans la corbeille : restaurez-la d'abord." };
  if (it.est_fiche_gaz) return { ok: true, data: { id: it.id } };
  const { count } = await supabase.from("interventions").select("id", { count: "exact", head: true }).eq("est_fiche_gaz", true).eq("date_intervention", it.date_intervention);
  const { error } = await supabase
    .from("interventions")
    .update({
      est_fiche_gaz: true,
      fiche_numero: it.fiche_numero ?? numeroFiche(it.date_intervention, (count ?? 0) + 1),
      natures_cerfa: naturesParDefaut(it),
    })
    .eq("id", it.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/fiches-gaz");
  revalidatePath(`/interventions/${it.id}`);
  return { ok: true, data: { id: it.id } };
}
