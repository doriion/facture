"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { aujourdhuiParis } from "@/lib/dates";
import { payloadLignesPdf } from "@/lib/pdf-payload";
import { estErreurMoteurTva, verifierMoteurTva } from "@/lib/tva-garde";
import { figerEmetteurDocument } from "@/lib/actions/emetteur-helpers";
import {
  buildDocumentEmail,
  buildRelanceEmail,
  isEmailConfigured,
  sendEmail,
  signatureDepuisProfil,
} from "@/lib/email";
import { formatDateFr, formatEuros } from "@/lib/format";
import { joursDeRetard } from "@/lib/relances-helpers";
import { getFacture, setFactureStatutAction } from "@/lib/actions/factures";
import { getFacturePaiements } from "@/lib/actions/paiements";
import { detailSolde } from "@/lib/actions/facture-solde";
import {
  estFactureVentilee,
  MOTIF_FACTURE_VENTILEE,
  transitionFactureAutorisee,
} from "@/lib/factures-transitions";
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
        "Envoi d'e-mail non configuré. Ajoutez GMAIL_USER et GMAIL_APP_PASSWORD (ou RESEND_API_KEY et RESEND_FROM) dans Vercel.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { facture, lignes, client } = await getFacture(factureId);
  if (!facture) return { ok: false, error: "Facture introuvable." };
  if (facture.statut === "annulee") {
    return { ok: false, error: "Cette facture est annulée : elle ne s'envoie pas." };
  }
  if (!client?.email) {
    return {
      ok: false,
      error: "Le client n'a pas d'adresse email — renseignez-la sur sa fiche.",
    };
  }
  // Mêmes règles que « Marquer envoyée » : une facture ventilée en
  // acomptes/solde ne part pas au client, et un brouillon passe par la
  // machine à états (gardes des avoirs, statut de la facture d'origine).
  const { data: enfants } = await supabase
    .from("factures")
    .select("statut, type_facture")
    .eq("facture_parent_id", factureId);
  if (estFactureVentilee(facture, enfants ?? [])) {
    return { ok: false, error: MOTIF_FACTURE_VENTILEE };
  }
  if (facture.statut === "brouillon") {
    const transition = transitionFactureAutorisee("brouillon", "envoyee", {
      typeFacture: facture.type_facture,
    });
    if (!transition.ok) return transition;
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

  // Garde-fou : jamais d'envoi d'un document assujetti à la TVA tant
  // que l'app ne sait pas la calculer.
  try {
    verifierMoteurTva(profil, facture.emetteur);
  } catch (e) {
    if (!estErreurMoteurTva(e)) throw e;
    return { ok: false, error: e.explication };
  }

  // Avoir : la facture corrigée est une mention obligatoire du PDF.
  const factureParent =
    facture.type_facture === "avoir" && facture.facture_parent_id
      ? (
          await supabase
            .from("factures")
            .select("numero, date_emission")
            .eq("id", facture.facture_parent_id)
            .maybeSingle()
        ).data
      : null;

  // Génère le PDF. Le moteur (@react-pdf/renderer : fontkit, pdfkit…)
  // et le gabarit ne sont chargés qu'ici : importés en tête de fichier,
  // ils étaient embarqués dans la fonction serveur de chaque page dont
  // un bouton importe ce fichier, et en ralentissaient le démarrage à froid.
  const [{ renderToBuffer }, { FacturePdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/factures/facture-pdf"),
  ]);
  const pdfBuffer = await renderToBuffer(
    FacturePdf({
      facture,
      lignes: payloadLignesPdf(lignes),
      client,
      profil,
      logoData: logoUrl,
      devisSource: await devisSourceDe(supabase, facture.devis_id),
      factureParent,
      solde: await detailSolde(supabase, facture),
    }),
  );

  const expediteurNom =
    profil.nom_commercial ||
    [profil.prenom, profil.nom].filter(Boolean).join(" ") ||
    "Auto-entrepreneur";

  const estAvoir = facture.type_facture === "avoir";
  const email = buildDocumentEmail({
    type: estAvoir ? "avoir" : "facture",
    numero: facture.numero,
    clientNom: client.nom,
    expediteurNom,
    totalText: formatEuros(Number(facture.total_ht)),
    // Avoir : pas d'échéance, mais la précision du mode.
    dateText: formatDateFr(facture.date_emission),
    signature: signatureDepuisProfil(profil, expediteurNom),
    echeanceText: estAvoir
      ? facture.mode_avoir === "remboursement"
        ? "qui vous sera remboursé"
        : `venant en déduction de la facture ${factureParent?.numero ?? ""}`.trim()
      : formatDateFr(facture.date_echeance),
    messagePerso,
  });

  const res = await sendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: profil.email_pro ?? undefined,
    fromName: expediteurNom,
    attachments: [
      {
        filename: `${facture.numero}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  if (!res.ok) return { ok: false, error: res.error };

  const now = new Date().toISOString();
  await supabase.from("factures").update({ email_envoye_le: now }).eq("id", factureId);

  // Brouillon : émission par la machine à états (plafond de l'avoir
  // revérifié, facture d'origine synchronisée, émetteur figé) — et non
  // par une mise à jour directe du statut.
  if (facture.statut === "brouillon") {
    const passage = await setFactureStatutAction(factureId, "envoyee");
    if (!passage.ok) {
      return {
        ok: false,
        error: `Email envoyé, mais le document n'a pas pu passer « envoyé » : ${passage.error}`,
      };
    }
  } else {
    // Document envoyé au client : mentions émetteur figées.
    await figerEmetteurDocument(supabase, "factures", factureId);
  }

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
        "Envoi d'e-mail non configuré. Ajoutez GMAIL_USER et GMAIL_APP_PASSWORD (ou RESEND_API_KEY et RESEND_FROM) dans Vercel.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { devis, lignes, client } = await getDevis(devisId);
  if (!devis) return { ok: false, error: "Devis introuvable." };
  if (devis.statut === "refuse") {
    return { ok: false, error: "Ce devis est refusé : repassez-le en brouillon avant de le renvoyer." };
  }
  if (devis.date_validite && devis.date_validite < aujourdhuiParis() && devis.statut !== "brouillon") {
    return {
      ok: false,
      error: "Ce devis est expiré : repassez-le en brouillon et prolongez sa validité avant de l'envoyer.",
    };
  }
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

  try {
    verifierMoteurTva(profil, devis.emetteur);
  } catch (e) {
    if (!estErreurMoteurTva(e)) throw e;
    return { ok: false, error: e.explication };
  }

  const [{ renderToBuffer }, { DevisPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/devis/devis-pdf"),
  ]);
  // Devis signé dans l'app : la signature « bon pour accord » figure
  // sur l'exemplaire envoyé (comme sur le PDF téléchargé).
  let signatureData: string | null = null;
  if (devis.signature_client_url) {
    try {
      const { data: blob } = await supabase.storage.from("signatures").download(devis.signature_client_url);
      if (blob) signatureData = `data:image/png;base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
    } catch {
      signatureData = null;
    }
  }
  const pdfBuffer = await renderToBuffer(
    DevisPdf({ devis, lignes: payloadLignesPdf(lignes), client, profil, logoData: logoUrl, signatureData }),
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
    signeLe: devis.signature_client_url && devis.date_signature ? formatDateFr(devis.date_signature) : undefined,
    dateText: formatDateFr(devis.date_emission),
    validiteText: devis.date_validite ? formatDateFr(devis.date_validite) : undefined,
    signature: signatureDepuisProfil(profil, expediteurNom),
  });

  const res = await sendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: profil.email_pro ?? undefined,
    fromName: expediteurNom,
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

  // Document envoyé au client : mentions émetteur figées.
  await figerEmetteurDocument(supabase, "devis", devisId);

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
        "Envoi d'e-mail non configuré. Ajoutez GMAIL_USER et GMAIL_APP_PASSWORD (ou RESEND_API_KEY et RESEND_FROM) dans Vercel.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { facture, lignes, client } = await getFacture(factureId);
  if (!facture) return { ok: false, error: "Facture introuvable." };
  if (facture.statut === "annulee") {
    return { ok: false, error: "Cette facture est annulée : elle ne s'envoie pas." };
  }
  if (!client?.email) {
    return {
      ok: false,
      error: "Le client n'a pas d'adresse email — renseignez-la sur sa fiche.",
    };
  }
  if (facture.statut !== "envoyee" || facture.type_facture === "avoir") {
    return { ok: false, error: "Seules les factures envoyées peuvent être relancées." };
  }
  const today = aujourdhuiParis();
  if (facture.date_echeance >= today) {
    return { ok: false, error: "Échéance pas encore dépassée." };
  }
  const joursRetard = joursDeRetard(facture.date_echeance, today);

  // Montant réclamé = reste dû (acompte encaissé, avoir imputé), pas le
  // total de la facture.
  const resume = await getFacturePaiements(factureId);
  if (resume.reste_du <= 0.005) {
    return { ok: false, error: "Cette facture est soldée : rien à relancer." };
  }
  const resteText =
    resume.reste_du < resume.total_facture - 0.005 ? formatEuros(resume.reste_du) : undefined;

  const profil = await getProfil();
  const expediteurNom =
    profil?.nom_commercial ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    "Auto-entrepreneur";

  // PDF de la facture joint à la relance (le client retrouve tout de suite
  // le document concerné).
  const logoUrl = profil?.logo_url ? await getLogoUrl(profil.logo_url) : null;
  try {
    verifierMoteurTva(profil, facture.emetteur);
  } catch (e) {
    if (!estErreurMoteurTva(e)) throw e;
    return { ok: false, error: e.explication };
  }
  const [{ renderToBuffer }, { FacturePdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/factures/facture-pdf"),
  ]);
  const pdfBuffer = await renderToBuffer(
    FacturePdf({
      facture,
      lignes: payloadLignesPdf(lignes),
      client,
      profil,
      logoData: logoUrl,
      devisSource: await devisSourceDe(supabase, facture.devis_id),
      solde: await detailSolde(supabase, facture),
    }),
  );

  const email = buildRelanceEmail({
    numero: facture.numero,
    clientNom: client.nom,
    expediteurNom,
    totalText: formatEuros(Number(facture.total_ht)),
    resteText,
    echeanceText: formatDateFr(facture.date_echeance),
    joursRetard,
    signature: signatureDepuisProfil(profil, expediteurNom),
  });

  const res = await sendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: profil?.email_pro ?? undefined,
    fromName: expediteurNom,
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

/** Devis d'origine d'une facture convertie (numéro + date), pour le PDF. */
async function devisSourceDe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  devisId: string | null,
): Promise<{ numero: string; date_emission: string | null } | null> {
  if (!devisId) return null;
  const { data } = await supabase
    .from("devis")
    .select("numero, date_emission")
    .eq("id", devisId)
    .maybeSingle();
  return data ?? null;
}
