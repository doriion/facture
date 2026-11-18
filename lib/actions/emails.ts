"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "node:crypto";
import { expirationLienDevis } from "@/lib/devis-public";
import { baseUrlPublique } from "@/lib/url-publique";
import { acompteDevis } from "@/lib/devis-mentions";
import { aujourdhuiParis } from "@/lib/dates";
import { payloadLignesPdf } from "@/lib/pdf-payload";
import { estErreurMoteurTva, verifierMoteurTva } from "@/lib/tva-garde";
import { figerEmetteurDocument } from "@/lib/actions/emetteur-helpers";
import {
  buildDocumentEmail,
  buildRelanceEmail,
  isEmailConfigured,
  sendEmail,
  signatureDepuisProfil, buildRelanceDevisEmail } from "@/lib/email";
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
  // Date(s) d'intervention pour la phrase d'intro : rien n'est inventé
  // si la facture n'en porte pas.
  const interventionText = facture.date_prestation
    ? facture.date_prestation_fin && facture.date_prestation_fin !== facture.date_prestation
      ? `du ${formatDateFr(facture.date_prestation)} au ${formatDateFr(facture.date_prestation_fin)}`
      : `du ${formatDateFr(facture.date_prestation)}`
    : undefined;
  const email = buildDocumentEmail({
    type: estAvoir ? "avoir" : "facture",
    numero: facture.numero,
    clientNom: client.nom,
    expediteurNom,
    totalText: formatEuros(Number(facture.total_ht)),
    natureActivite: facture.type_activite,
    interventionText: estAvoir ? undefined : interventionText,
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

type DevisCharge = Awaited<ReturnType<typeof getDevis>>;
type DevisPret = {
  devis: NonNullable<DevisCharge["devis"]>;
  numero: string;
  pdf: Buffer;
  lienSignature: string | null;
  signeLe: string | undefined;
};

/** Pourquoi un devis ne peut pas partir (null = il peut). */
function motifDevisNonEnvoyable(devis: NonNullable<DevisCharge["devis"]>): string | null {
  if (devis.statut === "refuse") return `Le devis ${devis.numero} est refusé : repassez-le en brouillon avant de le renvoyer.`;
  if (devis.date_validite && devis.date_validite < aujourdhuiParis() && devis.statut !== "brouillon") {
    return `Le devis ${devis.numero} est expiré : repassez-le en brouillon et prolongez sa validité avant de l'envoyer.`;
  }
  return null;
}

/**
 * PDF du devis (signature « bon pour accord » incluse s'il est signé) et
 * lien de signature en ligne, posé ou renouvelé s'il a expiré, pour un
 * devis non signé. Commun au devis principal et aux devis joints.
 */
async function preparerDevisPourEnvoi(
  supabase: Awaited<ReturnType<typeof createClient>>,
  charge: DevisCharge,
  profil: NonNullable<Awaited<ReturnType<typeof getProfil>>>,
  logoUrl: string | null,
): Promise<DevisPret> {
  const { devis, lignes, client } = charge;
  if (!devis) throw new Error("Devis introuvable.");
  // Garde TVA juste avant CHAQUE rendu (lève MoteurTvaNonImplementeError).
  verifierMoteurTva(profil, devis.emetteur);
  const [{ renderToBuffer }, { DevisPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/devis/devis-pdf"),
  ]);
  let signatureData: string | null = null;
  if (devis.signature_client_url) {
    try {
      const { data: blob } = await supabase.storage.from("signatures").download(devis.signature_client_url);
      if (blob) signatureData = `data:image/png;base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
    } catch {
      signatureData = null;
    }
  }
  const pdf = await renderToBuffer(
    DevisPdf({ devis, lignes: payloadLignesPdf(lignes), client, profil, logoData: logoUrl, signatureData }),
  );

  let lienSignature: string | null = null;
  if (!devis.signature_client_url && devis.statut !== "accepte") {
    const nowIso = new Date().toISOString();
    let token = devis.access_token;
    const expire = expirationLienDevis(devis.date_validite, nowIso);
    if (!token || !devis.token_expires_at || devis.token_expires_at <= nowIso) {
      token = randomBytes(32).toString("base64url");
    }
    const { error: erreurJeton } = await supabase
      .from("devis")
      .update({ access_token: token, token_expires_at: expire })
      .eq("id", devis.id);
    if (!erreurJeton) lienSignature = `${await baseUrlPublique()}/d/${token}`;
  }
  return {
    devis,
    numero: devis.numero,
    pdf,
    lienSignature,
    signeLe: devis.signature_client_url && devis.date_signature ? formatDateFr(devis.date_signature) : undefined,
  };
}

/**
 * Envoie le devis par email. Comportement symétrique à la facture.
 *
 * `autresDevisIds` : d'autres devis du MÊME client joints au même
 * e-mail (deux variantes d'un chantier) : un seul message, un PDF par
 * devis, un lien de signature par devis non signé. Chacun passe en
 * « envoyé » et voit ses mentions émetteur figées, comme un envoi seul.
 */
export async function envoyerDevisParEmailAction(
  devisId: string,
  messagePerso?: string,
  options: { relance?: boolean; autresDevisIds?: string[] } = {},
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

  const principal = await getDevis(devisId);
  const { devis, client } = principal;
  if (!devis) return { ok: false, error: "Devis introuvable." };
  const motif = motifDevisNonEnvoyable(devis);
  if (motif) return { ok: false, error: motif };
  if (!client?.email) {
    return {
      ok: false,
      error: "Le client n'a pas d'adresse email.",
    };
  }

  // Devis joints : même client, pas de modèle, envoyables, sans doublon.
  const autresIds = [...new Set((options.autresDevisIds ?? []).filter((id) => id && id !== devisId))].slice(0, 10);
  const autresCharges: DevisCharge[] = [];
  for (const id of autresIds) {
    const charge = await getDevis(id);
    if (!charge.devis) return { ok: false, error: "Un des devis à joindre est introuvable." };
    if (charge.devis.client_id !== devis.client_id) return { ok: false, error: `Le devis ${charge.devis.numero} n'est pas au même client.` };
    if (charge.devis.est_modele) return { ok: false, error: `Le devis ${charge.devis.numero} est un modèle.` };
    const m = motifDevisNonEnvoyable(charge.devis);
    if (m) return { ok: false, error: m };
    autresCharges.push(charge);
  }

  const profil = await getProfil();
  if (!profil) {
    return { ok: false, error: "Profil entreprise incomplet." };
  }
  const logoUrl = profil.logo_url
    ? await getLogoUrl(profil.logo_url)
    : null;

  const prets: DevisPret[] = [];
  try {
    for (const c of [principal, ...autresCharges]) prets.push(await preparerDevisPourEnvoi(supabase, c, profil, logoUrl));
  } catch (e) {
    if (!estErreurMoteurTva(e)) throw e;
    return { ok: false, error: e.explication };
  }
  const [pret, ...autresPrets] = prets as [DevisPret, ...DevisPret[]];

  const expediteurNom =
    profil.nom_commercial ||
    [profil.prenom, profil.nom].filter(Boolean).join(" ") ||
    "Auto-entrepreneur";

  const email = options.relance
    ? buildRelanceDevisEmail({
        numero: devis.numero,
        clientNom: client.nom,
        expediteurNom,
        totalText: formatEuros(Number(devis.total_ht)),
        dateText: formatDateFr(devis.date_emission),
        validiteText: devis.date_validite ? formatDateFr(devis.date_validite) : undefined,
        natureActivite: devis.type_activite,
        lienSignature: pret.lienSignature,
        messagePerso,
        signature: signatureDepuisProfil(profil, expediteurNom),
      })
    : buildDocumentEmail({
    type: "devis",
    numero: devis.numero,
    clientNom: client.nom,
    expediteurNom,
    totalText: formatEuros(Number(devis.total_ht)),
    messagePerso,
    lienSignature: pret.lienSignature,
    signeLe: pret.signeLe,
    dateText: formatDateFr(devis.date_emission),
    validiteText: devis.date_validite ? formatDateFr(devis.date_validite) : undefined,
    natureActivite: devis.type_activite,
    // Acompte demandé : même calcul que le PDF (le % prime). Sans acompte, rien n'est dit.
    acompteText: acompteDevis(
      Number(devis.total_ht),
      devis.acompte_pct !== null ? Number(devis.acompte_pct) : null,
      devis.acompte_montant !== null ? Number(devis.acompte_montant) : null,
    )?.texte,
    signature: signatureDepuisProfil(profil, expediteurNom),
    autresDevis: autresPrets.map((a) => ({
      numero: a.numero,
      totalText: formatEuros(Number(a.devis.total_ht)),
      lienSignature: a.lienSignature,
      signeLe: a.signeLe ?? null,
      validiteText: a.devis.date_validite ? formatDateFr(a.devis.date_validite) : null,
    })),
  });

  const res = await sendEmail({
    to: client.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    replyTo: profil.email_pro ?? undefined,
    fromName: expediteurNom,
    attachments: prets.map((p) => ({
      filename: `${p.numero}.pdf`,
      content: p.pdf,
      contentType: "application/pdf",
    })),
  });

  if (!res.ok) return { ok: false, error: res.error };

  const now = new Date().toISOString();
  for (const p of prets) {
    await supabase
      .from("devis")
      .update({
        email_envoye_le: now,
        statut: p.devis.statut === "brouillon" ? "envoye" : p.devis.statut,
      })
      .eq("id", p.devis.id);

    // Document envoyé au client : mentions émetteur figées.
    await figerEmetteurDocument(supabase, "devis", p.devis.id);
    revalidatePath(`/devis/${p.devis.id}`);
  }

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

/**
 * Relance d'un devis envoyé resté sans réponse : même PDF, même lien de
 * signature, texte de rappel. MANUELLE (bouton du fil du jour ou de la
 * fiche devis). L'envoi met à jour la date de dernier envoi au client.
 */
export async function envoyerRelanceDevisAction(devisId: string, messagePerso?: string): Promise<ActionResult> {
  return envoyerDevisParEmailAction(devisId, messagePerso, { relance: true });
}
