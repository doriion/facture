"use server";

import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import {
  buildDocumentEmail,
  buildRelanceEmail,
  isEmailConfigured,
  sendEmail,
} from "@/lib/email";
import { formatDateFr, formatEuros } from "@/lib/format";
import { FacturePdf } from "@/components/factures/facture-pdf";
import { DevisPdf } from "@/components/devis/devis-pdf";
import { getFacture } from "@/lib/actions/factures";
import { getDevis } from "@/lib/actions/devis";
import { getProfil, getLogoUrl } from "@/lib/actions/profil";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Envoie la facture par email avec le PDF en pièce jointe. Met à jour
 * `factures.email_envoye_le` au passage. Le statut passe en « envoyée »
 * si elle était encore en brouillon.
 */
export async function envoyerFactureParEmailAction(
  factureId: string,
  messagePerso?: string,
): Promise<ActionResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error:
        "Resend non configuré. Ajoutez RESEND_API_KEY et RESEND_FROM dans Vercel.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { facture, lignes, client } = await getFacture(factureId);
  if (!facture) return { ok: false, error: "Facture introuvable." };
  if (!client?.email) {
    return {
      ok: false,
      error: "Le client n'a pas d'adresse email — renseignez-la sur sa fiche.",
    };
  }

  const profil = await getProfil();
  if (!profil) {
    return {
      ok: false,
      error: "Profil entreprise incomplet — renseignez-le dans Paramètres.",
    };
  }
  const logoUrl = profil.logo_url
    ? await getLogoUrl(profil.logo_url)
    : null;

  // Génère le PDF
  const pdfBuffer = await renderToBuffer(
    FacturePdf({
      facture,
      lignes,
      client,
      profil,
      logoData: logoUrl,
    }),
  );

  const expediteurNom =
    profil.nom_commercial ||
    [profil.prenom, profil.nom].filter(Boolean).join(" ") ||
    "Auto-entrepreneur";

  const email = buildDocumentEmail({
    type: "facture",
    numero: facture.numero,
    clientNom: client.nom,
    expediteurNom,
    totalText: formatEuros(Number(facture.total_ht)),
    echeanceText: formatDateFr(facture.date_echeance),
    messagePerso,
  });

  const res = await sendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: profil.email_pro ?? undefined,
    attachments: [
      {
        filename: `${facture.numero}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (!res.ok) return { ok: false, error: res.error };

  // Update DB
  const now = new Date().toISOString();
  await supabase
    .from("factures")
    .update({
      email_envoye_le: now,
      statut: facture.statut === "brouillon" ? "envoyee" : facture.statut,
    })
    .eq("id", factureId);

  revalidatePath(`/factures/${factureId}`);
  revalidatePath("/factures");
  return { ok: true, data: undefined };
}

/**
 * Envoie le devis par email. Comportement symétrique à la facture.
 */
export async function envoyerDevisParEmailAction(
  devisId: string,
  messagePerso?: string,
): Promise<ActionResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error:
        "Resend non configuré. Ajoutez RESEND_API_KEY et RESEND_FROM dans Vercel.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { devis, lignes, client } = await getDevis(devisId);
  if (!devis) return { ok: false, error: "Devis introuvable." };
  if (!client?.email) {
    return {
      ok: false,
      error: "Le client n'a pas d'adresse email.",
    };
  }

  const profil = await getProfil();
  if (!profil) {
    return { ok: false, error: "Profil entreprise incomplet." };
  }
  const logoUrl = profil.logo_url
    ? await getLogoUrl(profil.logo_url)
    : null;

  const pdfBuffer = await renderToBuffer(
    DevisPdf({ devis, lignes, client, profil, logoData: logoUrl }),
  );

  const expediteurNom =
    profil.nom_commercial ||
    [profil.prenom, profil.nom].filter(Boolean).join(" ") ||
    "Auto-entrepreneur";

  const email = buildDocumentEmail({
    type: "devis",
    numero: devis.numero,
    clientNom: client.nom,
    expediteurNom,
    totalText: formatEuros(Number(devis.total_ht)),
    messagePerso,
  });

  const res = await sendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: profil.email_pro ?? undefined,
    attachments: [
      {
        filename: `${devis.numero}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (!res.ok) return { ok: false, error: res.error };

  const now = new Date().toISOString();
  await supabase
    .from("devis")
    .update({
      email_envoye_le: now,
      statut: devis.statut === "brouillon" ? "envoye" : devis.statut,
    })
    .eq("id", devisId);

  revalidatePath(`/devis/${devisId}`);
  revalidatePath("/devis");
  return { ok: true, data: undefined };
}

/**
 * Envoie une relance sur une facture en retard.
 */
export async function envoyerRelanceFactureAction(
  factureId: string,
): Promise<ActionResult> {
  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: "Resend non configuré.",
    };
  }
  const { facture, client } = await getFacture(factureId);
  if (!facture) return { ok: false, error: "Facture introuvable." };
  if (!client?.email) {
    return { ok: false, error: "Email du client manquant." };
  }
  if (facture.statut !== "envoyee") {
    return { ok: false, error: "Seules les factures envoyées peuvent être relancées." };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (facture.date_echeance >= today) {
    return { ok: false, error: "Échéance pas encore dépassée." };
  }
  const joursRetard = Math.floor(
    (new Date(today).getTime() - new Date(facture.date_echeance).getTime()) /
      (24 * 3600 * 1000),
  );

  const profil = await getProfil();
  const expediteurNom =
    profil?.nom_commercial ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    "Auto-entrepreneur";

  const email = buildRelanceEmail({
    numero: facture.numero,
    clientNom: client.nom,
    expediteurNom,
    totalText: formatEuros(Number(facture.total_ht)),
    echeanceText: formatDateFr(facture.date_echeance),
    joursRetard,
  });

  const res = await sendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: profil?.email_pro ?? undefined,
  });

  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: undefined };
}
