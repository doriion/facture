"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import {
  contratEntretienSchema,
  type ContratEntretienFormInput,
} from "@/lib/validations/contrat-entretien";
import {
  echeanceInitiale,
  expirationToken,
  TEMPLATE_VERSION_COURANTE,
} from "@/lib/contrats/logic";
import { buildPrestataireSnapshot } from "@/lib/contrats/rendu";
import { buildLienContratEmail, isEmailConfigured, sendEmail } from "@/lib/email";
import { formatDateFr } from "@/lib/format";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

import type { Database } from "@/types/database";

export type ContratEntretienRow =
  Database["public"]["Tables"]["contrats"]["Row"];

export type ContratEntretienListe = ContratEntretienRow & {
  client: { nom: string; email: string | null } | null;
};

/** Liste des contrats signables, filtrable par statut et recherche. */
export async function listContratsEntretien(params?: {
  search?: string;
  statut?: string;
}): Promise<ContratEntretienListe[]> {
  const supabase = createClient();
  let query = supabase
    .from("contrats")
    .select("*, client:clients(nom, email)")
    .order("created_at", { ascending: false });

  if (params?.statut && params.statut !== "tous") {
    query = query.eq("statut", params.statut);
  }

  const { data } = await query;
  let contrats = (data ?? []) as unknown as ContratEntretienListe[];

  const recherche = params?.search?.trim().toLowerCase();
  if (recherche) {
    contrats = contrats.filter(
      (c) =>
        (c.numero ?? "").toLowerCase().includes(recherche) ||
        (c.client?.nom ?? "").toLowerCase().includes(recherche) ||
        (c.adresse_site ?? "").toLowerCase().includes(recherche),
    );
  }
  return contrats;
}

export async function getContratEntretien(
  id: string,
): Promise<ContratEntretienListe | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("contrats")
    .select("*, client:clients(nom, email)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ContratEntretienListe) ?? null;
}

export async function createContratEntretienAction(
  input: ContratEntretienFormInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = contratEntretienSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Saisie invalide.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data, error } = await supabase
    .from("contrats")
    .insert({
      user_id: user.id,
      client_id: v.client_id,
      adresse_site: v.adresse_site || null,
      equipements: v.equipements,
      redevance: v.redevance,
      remise: v.remise,
      plafond_pieces: v.plafond_pieces,
      date_effet: v.date_effet,
      date_echeance: echeanceInitiale(v.date_effet),
      qualite_client: v.qualite_client,
      mode_conclusion: v.mode_conclusion,
      template_version: TEMPLATE_VERSION_COURANTE,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Erreur d'enregistrement." };
  }

  revalidatePath("/contrats");
  return { ok: true, data: { id: data.id } };
}

/** Modification — brouillon uniquement : un contrat envoyé ou signé est figé. */
export async function updateContratEntretienAction(
  id: string,
  input: ContratEntretienFormInput,
): Promise<ActionResult> {
  const parsed = contratEntretienSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Saisie invalide.",
    };
  }
  const v = parsed.data;

  const supabase = createClient();
  const { data: existant } = await supabase
    .from("contrats")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existant) return { ok: false, error: "Contrat introuvable." };
  if (existant.statut !== "brouillon") {
    return {
      ok: false,
      error: "Seul un brouillon peut être modifié — un contrat envoyé est figé.",
    };
  }

  const { error } = await supabase
    .from("contrats")
    .update({
      client_id: v.client_id,
      adresse_site: v.adresse_site || null,
      equipements: v.equipements,
      redevance: v.redevance,
      remise: v.remise,
      plafond_pieces: v.plafond_pieces,
      date_effet: v.date_effet,
      date_echeance: echeanceInitiale(v.date_effet),
      qualite_client: v.qualite_client,
      mode_conclusion: v.mode_conclusion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("statut", "brouillon");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contrats");
  revalidatePath(`/contrats/${id}`);
  return { ok: true, data: undefined };
}

/** Suppression — brouillon uniquement (un contrat envoyé/signé s'archive, il ne s'efface pas). */
export async function deleteContratEntretienAction(
  id: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: existant } = await supabase
    .from("contrats")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existant) return { ok: false, error: "Contrat introuvable." };
  if (existant.statut !== "brouillon") {
    return {
      ok: false,
      error:
        "Seul un brouillon peut être supprimé. Pour un contrat envoyé, révoquez le lien ; pour un contrat signé, résiliez-le.",
    };
  }

  const { error } = await supabase
    .from("contrats")
    .delete()
    .eq("id", id)
    .eq("statut", "brouillon");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contrats");
  return { ok: true, data: undefined };
}

/**
 * Envoi du contrat au client : fige les snapshots (prestataire depuis
 * les réglages, client depuis sa fiche), attribue le numéro s'il
 * n'existe pas, génère un lien public (30 jours) et envoie l'email
 * d'invitation. Ré-appelable sur un contrat déjà envoyé mais non signé
 * (renvoi = nouveau token, l'ancien lien meurt).
 */
export async function envoyerContratAction(
  id: string,
): Promise<ActionResult<{ lien: string }>> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error:
        "Resend non configuré (RESEND_API_KEY / RESEND_FROM) — impossible d'envoyer.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: contratData } = await supabase
    .from("contrats")
    .select("*, client:clients(*)")
    .eq("id", id)
    .maybeSingle();
  if (!contratData) return { ok: false, error: "Contrat introuvable." };

  const { client, ...contrat } = contratData as typeof contratData & {
    client: Database["public"]["Tables"]["clients"]["Row"] | null;
  };

  if (contrat.statut !== "brouillon" && contrat.statut !== "envoye") {
    return {
      ok: false,
      error: "Ce contrat est déjà signé — rien à envoyer.",
    };
  }
  if (!client?.email) {
    return {
      ok: false,
      error:
        "Le client n'a pas d'adresse e-mail — ajoutez-la sur sa fiche avant l'envoi.",
    };
  }
  if (
    !Array.isArray(contrat.equipements) ||
    contrat.equipements.length === 0
  ) {
    return { ok: false, error: "Ajoutez au moins un équipement couvert." };
  }

  const { data: profil } = await supabase
    .from("profil_entreprise")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const prestataire = buildPrestataireSnapshot(profil ?? null);
  if (!prestataire?.siret) {
    return {
      ok: false,
      error:
        "Complétez votre SIRET dans Paramètres avant d'envoyer un contrat.",
    };
  }

  // Numéro : attribué UNE seule fois, au premier envoi
  let numero = contrat.numero;
  if (!numero) {
    const { data: nouveauNumero, error: numErr } = await supabase.rpc(
      "next_document_number",
      { p_type: "contrat" },
    );
    if (numErr || !nouveauNumero) {
      return {
        ok: false,
        error: numErr?.message ?? "Numérotation indisponible.",
      };
    }
    numero = nouveauNumero;
  }

  const nowIso = new Date().toISOString();
  const token = randomBytes(32).toString("base64url");
  const tokenExpiresAt = expirationToken(nowIso);

  const clientSnapshot = {
    nom: client.nom,
    raison_sociale: client.raison_sociale,
    adresse: [
      client.adresse_ligne1,
      client.adresse_ligne2,
      [client.code_postal, client.ville].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", "),
    telephone: client.telephone,
    email: client.email,
    siret: client.siret,
  };

  const { error: updateErr } = await supabase
    .from("contrats")
    .update({
      numero,
      statut: "envoye",
      prestataire,
      client_snapshot: clientSnapshot,
      access_token: token,
      token_expires_at: tokenExpiresAt,
      sent_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", id)
    .in("statut", ["brouillon", "envoye"]);
  if (updateErr) return { ok: false, error: updateErr.message };

  // URL absolue du lien public, à partir de l'hôte de la requête
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const lien = `${proto}://${host}/c/${token}`;

  const expediteurNom =
    profil?.nom_commercial ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    "Votre artisan";
  const email = buildLienContratEmail({
    clientNom: client.nom,
    expediteurNom,
    numero: numero!,
    lien,
    expireLeText: formatDateFr(tokenExpiresAt.slice(0, 10)),
  });
  const envoi = await sendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: profil?.email_pro ?? undefined,
  });
  if (!envoi.ok) {
    // Le contrat reste « envoyé » avec un lien valide : on peut copier
    // le lien à la main ou re-tenter l'envoi.
    return {
      ok: false,
      error: `Contrat prêt mais email non parti : ${envoi.error}. Le lien reste copiable depuis la fiche.`,
    };
  }

  revalidatePath("/contrats");
  revalidatePath(`/contrats/${id}`);
  return { ok: true, data: { lien } };
}

/** Révoque le lien public d'un contrat envoyé (le lien meurt aussitôt). */
export async function revoquerLienContratAction(
  id: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase
    .from("contrats")
    .update({
      access_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("statut", "envoye");
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/contrats/${id}`);
  return { ok: true, data: undefined };
}

/**
 * Changement de statut manuel côté admin, borné aux transitions
 * légitimes : signé → actif (mise en service), signé/actif → résilié,
 * actif → expiré. L'envoi et la signature ont leurs propres actions.
 */
const TRANSITIONS_MANUELLES: Record<string, string[]> = {
  signe: ["actif", "resilie"],
  actif: ["resilie", "expire"],
};

export async function changerStatutContratAction(
  id: string,
  statut: string,
): Promise<ActionResult> {
  const supabase = createClient();
  const { data: existant } = await supabase
    .from("contrats")
    .select("statut")
    .eq("id", id)
    .maybeSingle();
  if (!existant) return { ok: false, error: "Contrat introuvable." };

  const autorises = TRANSITIONS_MANUELLES[existant.statut] ?? [];
  if (!autorises.includes(statut)) {
    return {
      ok: false,
      error: `Passage « ${existant.statut} » → « ${statut} » non autorisé.`,
    };
  }

  const { error } = await supabase
    .from("contrats")
    .update({ statut, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contrats");
  revalidatePath(`/contrats/${id}`);
  return { ok: true, data: undefined };
}
