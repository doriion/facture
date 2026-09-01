/**
 * Wrapper léger autour de Resend pour l'envoi d'emails transactionnels :
 * - envoi de factures et devis (PDF en pièce jointe)
 * - relances de factures impayées
 *
 * Configuration : variables d'environnement Vercel
 * - RESEND_API_KEY : clé API Resend (commence par re_…)
 * - RESEND_FROM : adresse d'expédition (ex : "Facture AE <facture@tondomaine.fr>")
 *
 * En l'absence de ces variables, les actions d'email retourneront une
 * erreur explicite et l'utilisateur sera invité à configurer Resend.
 */

import { Resend } from "resend";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
  replyTo?: string;
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export async function sendEmail(params: SendEmailParams): Promise<{
  ok: true;
  id: string;
} | {
  ok: false;
  error: string;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Resend non configuré. Ajoutez RESEND_API_KEY et RESEND_FROM dans les variables d'environnement Vercel.",
    };
  }

  const resend = new Resend(apiKey);
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      attachments: params.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? "" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erreur d'envoi inconnue.",
    };
  }
}

/**
 * Construit le corps email (HTML simple + texte plain) pour l'envoi
 * d'une facture ou d'un devis au client.
 */
export function buildDocumentEmail(args: {
  type: "facture" | "devis";
  numero: string;
  clientNom: string;
  expediteurNom: string;
  totalText: string;
  echeanceText?: string;
  messagePerso?: string;
}): { subject: string; html: string; text: string } {
  const titre =
    args.type === "facture" ? "Votre facture" : "Votre devis";
  const subject = `${titre} ${args.numero}${args.expediteurNom ? " — " + args.expediteurNom : ""}`;

  const intro =
    args.type === "facture"
      ? `<p>Bonjour ${escapeHtml(args.clientNom)},</p>
         <p>Veuillez trouver ci-joint la facture <strong>${escapeHtml(args.numero)}</strong> d'un montant de <strong>${escapeHtml(args.totalText)}</strong>${args.echeanceText ? `, à régler avant le <strong>${escapeHtml(args.echeanceText)}</strong>` : ""}.</p>`
      : `<p>Bonjour ${escapeHtml(args.clientNom)},</p>
         <p>Veuillez trouver ci-joint le devis <strong>${escapeHtml(args.numero)}</strong> d'un montant de <strong>${escapeHtml(args.totalText)}</strong>.</p>
         <p>Merci de me retourner ce devis daté, signé et avec la mention « bon pour accord » pour validation.</p>`;

  const perso = args.messagePerso?.trim()
    ? `<p>${escapeHtml(args.messagePerso).replace(/\n/g, "<br/>")}</p>`
    : "";

  const signature = args.expediteurNom
    ? `<p style="margin-top:24px;">Cordialement,<br/><strong>${escapeHtml(args.expediteurNom)}</strong></p>`
    : "";

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111; max-width:600px; margin:auto; padding:16px; line-height:1.5;">
${intro}
${perso}
<p>Pour toute question, je reste à votre disposition.</p>
${signature}
<hr style="margin:24px 0; border:none; border-top:1px solid #eee;"/>
<p style="font-size:12px; color:#666;">Envoyé via Facture AE.</p>
</body></html>`;

  const textIntro =
    args.type === "facture"
      ? `Bonjour ${args.clientNom},\n\nVeuillez trouver ci-joint la facture ${args.numero} d'un montant de ${args.totalText}${args.echeanceText ? `, à régler avant le ${args.echeanceText}` : ""}.\n\n`
      : `Bonjour ${args.clientNom},\n\nVeuillez trouver ci-joint le devis ${args.numero} d'un montant de ${args.totalText}.\nMerci de me retourner ce devis signé pour validation.\n\n`;

  const text =
    textIntro +
    (args.messagePerso?.trim() ? args.messagePerso + "\n\n" : "") +
    "Pour toute question, je reste à votre disposition.\n\n" +
    (args.expediteurNom ? `Cordialement,\n${args.expediteurNom}\n` : "") +
    "\n— Envoyé via Facture AE";

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Email de relance pour facture impayée. Ton ferme mais courtois.
 */
export function buildRelanceEmail(args: {
  numero: string;
  clientNom: string;
  expediteurNom: string;
  totalText: string;
  echeanceText: string;
  joursRetard: number;
}): { subject: string; html: string; text: string } {
  const subject = `Relance — Facture ${args.numero} impayée depuis ${args.joursRetard} jours`;

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111; max-width:600px; margin:auto; padding:16px; line-height:1.5;">
<p>Bonjour ${escapeHtml(args.clientNom)},</p>
<p>Sauf erreur de ma part, la facture <strong>${escapeHtml(args.numero)}</strong> d'un montant de <strong>${escapeHtml(args.totalText)}</strong> dont l'échéance était fixée au <strong>${escapeHtml(args.echeanceText)}</strong> n'a pas été réglée à ce jour (<strong>${args.joursRetard} jours de retard</strong>).</p>
<p>Pourriez-vous procéder au règlement dans les meilleurs délais ?</p>
<p>Si le paiement a été effectué entre temps, considérez ce mail comme nul et merci de me communiquer la date d'encaissement.</p>
<p style="margin-top:24px;">Cordialement,<br/><strong>${escapeHtml(args.expediteurNom)}</strong></p>
<hr style="margin:24px 0; border:none; border-top:1px solid #eee;"/>
<p style="font-size:12px; color:#666;">Envoyé via Facture AE.</p>
</body></html>`;

  const text = `Bonjour ${args.clientNom},

Sauf erreur de ma part, la facture ${args.numero} d'un montant de ${args.totalText} dont l'échéance était fixée au ${args.echeanceText} n'a pas été réglée à ce jour (${args.joursRetard} jours de retard).

Pourriez-vous procéder au règlement dans les meilleurs délais ?

Si le paiement a été effectué entre temps, considérez ce mail comme nul et merci de me communiquer la date d'encaissement.

Cordialement,
${args.expediteurNom}

— Envoyé via Facture AE`;

  return { subject, html, text };
}

/**
 * Email de rappel d'entretien (contrat de maintenance). Ton cordial :
 * on invite le client à prendre rendez-vous, avec les coordonnées de
 * l'artisan pour répondre directement.
 */
export function buildRappelEntretienEmail(args: {
  clientNom: string;
  expediteurNom: string;
  /** Libellé du contrat ou de l'équipement (ex. « Entretien clim annuel ») */
  objetEntretien: string;
  /** Date de visite prévue, déjà formatée (ex. « 20 septembre 2026 ») */
  dateVisiteText: string;
  telephone?: string | null;
  emailPro?: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `Rappel d'entretien — ${args.objetEntretien}${args.expediteurNom ? " — " + args.expediteurNom : ""}`;

  const coordonnees = [
    args.telephone ? `par téléphone au ${args.telephone}` : null,
    args.emailPro ? `par email à ${args.emailPro}` : null,
  ]
    .filter(Boolean)
    .join(" ou ");

  const contactHtml = coordonnees
    ? `<p>Pour convenir d'un rendez-vous, vous pouvez me joindre ${escapeHtml(coordonnees)}, ou simplement répondre à ce message.</p>`
    : `<p>Pour convenir d'un rendez-vous, vous pouvez simplement répondre à ce message.</p>`;

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111; max-width:600px; margin:auto; padding:16px; line-height:1.5;">
<p>Bonjour ${escapeHtml(args.clientNom)},</p>
<p>La prochaine visite d'entretien de votre installation (<strong>${escapeHtml(args.objetEntretien)}</strong>) est prévue aux alentours du <strong>${escapeHtml(args.dateVisiteText)}</strong>.</p>
<p>Un entretien régulier garantit le bon fonctionnement et la longévité de votre équipement.</p>
${contactHtml}
<p style="margin-top:24px;">Cordialement,<br/><strong>${escapeHtml(args.expediteurNom)}</strong></p>
<hr style="margin:24px 0; border:none; border-top:1px solid #eee;"/>
<p style="font-size:12px; color:#666;">Envoyé via Facture AE.</p>
</body></html>`;

  const contactText = coordonnees
    ? `Pour convenir d'un rendez-vous, vous pouvez me joindre ${coordonnees}, ou simplement répondre à ce message.`
    : `Pour convenir d'un rendez-vous, vous pouvez simplement répondre à ce message.`;

  const text = `Bonjour ${args.clientNom},

La prochaine visite d'entretien de votre installation (${args.objetEntretien}) est prévue aux alentours du ${args.dateVisiteText}.

Un entretien régulier garantit le bon fonctionnement et la longévité de votre équipement.

${contactText}

Cordialement,
${args.expediteurNom}

— Envoyé via Facture AE`;

  return { subject, html, text };
}
