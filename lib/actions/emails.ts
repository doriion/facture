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
import { joursDeRetard } from "@/lib/relances-helpers";
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
 * Envoie une relance sur une facture en retard, avec le PDF de la
 * facture en pièce jointe, puis trace l'envoi dans la table `relances`
 * (best-effort : l'email part même si le traçage échoue).
 * Envoi MANUEL uniquement — déclenché par l'utilisateur.
 */
export async function envoyerRelanceFactureAction(
  factureId: string,
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
  if (facture.statut !== "envoyee") {
    return { ok: false, error: "Seules les factures envoyées peuvent être relancées." };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (facture.date_echeance >= today) {
    return { ok: false, error: "Échéance pas encore dépassée." };
  }
  const joursRetard = joursDeRetard(facture.date_echeance, today);

  const profil = await getProfil();
  const expediteurNom =
    profil?.nom_commercial ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    "Auto-entrepreneur";

  // PDF de la facture joint à la relance (le client retrouve tout de suite
  // le document concerné).
  const logoUrl = profil?.logo_url ? await getLogoUrl(profil.logo_url) : null;
  const pdfBuffer = await renderToBuffer(
    FacturePdf({
      facture,
      lignes,
      client,
      profil,
      logoData: logoUrl,
    }),
  );

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
    attachments: [
      {
        filename: `${facture.numero}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (!res.ok) return { ok: false, error: res.error };

  // Traçage de la relance. Best-effort : si la table n'existe pas encore
  // (migration non appliquée), l'envoi reste considéré comme réussi.
  await supabase.from("relances").insert({
    user_id: user.id,
    facture_id: factureId,
    destinataire: client.email,
    jours_retard: joursRetard,
  });

  revalidatePath("/factures");
  revalidatePath(`/factures/${factureId}`);
  return { ok: true, data: undefined };
}
