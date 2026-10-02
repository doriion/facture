/**
 * Envoi des e-mails transactionnels (devis, factures, relances,
 * sauvegardes, rappels) par l'un des deux canaux :
 *
 * 1. GMAIL (prioritaire) — le client reçoit un e-mail qui vient
 *    vraiment de l'adresse Gmail de l'artisan, et le message figure
 *    dans ses « Messages envoyés ». Variables Vercel :
 *    - GMAIL_USER : l'adresse (ex. nathangeneve.pro@gmail.com)
 *    - GMAIL_APP_PASSWORD : un « mot de passe d'application » Google
 *      (16 caractères, compte avec validation en 2 étapes), jamais le
 *      mot de passe du compte.
 *    Limite Google : ~500 destinataires par jour, largement assez.
 *
 * 2. RESEND (repli) — nécessite un domaine vérifié :
 *    - RESEND_API_KEY, RESEND_FROM ("NG Gestion <contact@domaine.fr>").
 *
 * Sans l'un ni l'autre, les actions renvoient une erreur explicite.
 */

import { Resend } from "resend";

import { mentionTvaFranchise } from "@/lib/legal-text";
import { NOM_APPLICATION } from "@/lib/marque";
import { adresseExpediteur } from "@/lib/expediteur-email";
import { formatTelephone } from "@/lib/format";
import {
  emailDepuisContenu,
  escapeHtml,
  signatureDepuisProfil,
  type SignatureEmail,
} from "@/lib/email-gabarit";

export { escapeHtml, signatureDepuisProfil };
export type { SignatureEmail };

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
  /** Nom affiché comme expéditeur (Gmail : devant l'adresse du compte). */
  fromName?: string;
};

function gmailConfigure(): { user: string; motDePasse: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  const motDePasse = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  return user && motDePasse ? { user, motDePasse } : null;
}

export function isEmailConfigured(): boolean {
  return Boolean(gmailConfigure() || (process.env.RESEND_API_KEY && process.env.RESEND_FROM));
}

/** Canal actif, pour l'affichage dans Paramètres. */
export function canalEmail(): "gmail" | "resend" | null {
  if (gmailConfigure()) return "gmail";
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) return "resend";
  return null;
}

async function envoyerParGmail(
  compte: { user: string; motDePasse: string },
  params: SendEmailParams,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // Chargé à la demande : seules les actions qui envoient paient le poids.
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: compte.user, pass: compte.motDePasse },
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
  });
  try {
    const info = await transport.sendMail({
      from: adresseExpediteur(params.fromName ?? NOM_APPLICATION, compte.user),
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
    return { ok: true, id: info.messageId ?? "" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur d'envoi inconnue.";
    // Les erreurs SMTP de Google sont verbeuses : on garde l'essentiel.
    if (/535|Username and Password not accepted|BadCredentials/i.test(message)) {
      return {
        ok: false,
        error:
          "Gmail a refusé l'identifiant : vérifiez GMAIL_USER et le mot de passe d'application (16 caractères, validation en 2 étapes activée).",
      };
    }
    return { ok: false, error: message };
  } finally {
    transport.close();
  }
}

export async function sendEmail(params: SendEmailParams): Promise<{
  ok: true;
  id: string;
} | {
  ok: false;
  error: string;
}> {
  const gmail = gmailConfigure();
  if (gmail) return envoyerParGmail(gmail, params);

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Envoi d'e-mail non configuré. Ajoutez GMAIL_USER et GMAIL_APP_PASSWORD (ou RESEND_API_KEY et RESEND_FROM) dans les variables d'environnement Vercel.",
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

/** Signature de repli quand l'appelant n'a que le nom. */
const sig = (signature: SignatureEmail | undefined, nom: string): SignatureEmail => signature ?? { nom };

/** « pour les travaux de plomberie », « pour l'installation de votre climatisation »… (clé type_activite). */
export function objetPrestation(natureActivite: string | null | undefined): string {
  switch (natureActivite) {
    case "plomberie":
      return "pour les travaux de plomberie";
    case "installation_clim":
      return "pour l'installation de votre climatisation";
    case "installation_pac":
      return "pour l'installation de votre pompe à chaleur";
    case "entretien":
      return "pour l'entretien de votre installation";
    case "depannage":
      return "pour le dépannage";
    default:
      return "pour les travaux dont nous avons parlé";
  }
}

/**
 * E-mail d'envoi d'une facture, d'un avoir ou d'un devis (PDF joint).
 */
export function buildDocumentEmail(args: {
  type: "facture" | "devis" | "avoir";
  numero: string;
  clientNom: string;
  expediteurNom: string;
  totalText: string;
  echeanceText?: string;
  messagePerso?: string;
  /** Devis déjà signé « bon pour accord » (date) : copie pour le client, rien à retourner. */
  signeLe?: string;
  /** Validité du devis, déjà formatée. */
  validiteText?: string;
  /** Date d'émission, déjà formatée. */
  dateText?: string;
  /** Nature de la prestation (clé type_activite du document), pour la phrase d'intro. */
  natureActivite?: string | null;
  /** Facture : date(s) d'intervention déjà formatées, « du 28/09/2026 » ou « du 25/09/2026 au 28/09/2026 ». */
  interventionText?: string;
  signature?: SignatureEmail;
}): { subject: string; html: string; text: string } {
  const libelle = args.type === "facture" ? "Facture" : args.type === "avoir" ? "Avoir" : "Devis";
  const objet = objetPrestation(args.natureActivite);
  const subject = `${args.type === "facture" ? "Votre facture" : args.type === "avoir" ? "Votre avoir" : "Votre devis"} ${args.numero}${args.expediteurNom ? " — " + args.expediteurNom : ""}`;

  const paragraphes: string[] = [];
  const resume: Array<[string, string]> = [[libelle, args.numero]];
  // « Émise le » pour la facture, « Émis le » pour le devis et l'avoir :
  // « Date » prêtait à confusion avec la date d'intervention.
  if (args.dateText) resume.push([args.type === "facture" ? "Émise le" : "Émis le", args.dateText]);
  resume.push(["Montant", args.totalText]);

  if (args.type === "avoir") {
    paragraphes.push(`Voici votre avoir ${args.numero}${args.echeanceText ? `, ${args.echeanceText}` : ""}. Vous le trouverez en pièce jointe.`);
  } else if (args.type === "facture") {
    paragraphes.push(
      `Voici votre facture ${args.numero} ${objet}${args.interventionText ? `, suite à mon intervention ${args.interventionText}` : ""}. Vous la trouverez en pièce jointe.`,
    );
    paragraphes.push(
      args.echeanceText
        ? `Elle est à régler avant le ${args.echeanceText}, par virement : les coordonnées bancaires figurent sur la facture.`
        : "Elle est à régler par virement : les coordonnées bancaires figurent sur la facture.",
    );
    if (args.echeanceText) resume.push(["À régler avant le", args.echeanceText]);
  } else if (args.signeLe) {
    paragraphes.push(
      `Voici votre exemplaire du devis ${args.numero} ${objet}, signé « bon pour accord » le ${args.signeLe}. Merci pour votre confiance : je reviens vers vous rapidement pour caler la date d'intervention.`,
    );
    resume.push(["Signé le", args.signeLe]);
  } else {
    paragraphes.push(
      `Comme convenu, voici votre devis ${args.numero} ${objet}. Vous y trouverez le détail des prestations et le montant, en pièce jointe.`,
    );
    if (args.validiteText) {
      paragraphes.push(`Il est valable jusqu'au ${args.validiteText} ; n'hésitez pas à me poser vos questions d'ici là.`);
      resume.push(["Valable jusqu'au", args.validiteText]);
    }
  }

  const conclusion =
    args.type === "devis" && !args.signeLe
      ? "S'il vous convient, un retour signé avec la mention « bon pour accord » suffit, ou répondez simplement à ce message : nous fixerons ensemble une date."
      : args.type === "facture"
        ? "Pour toute question, répondez simplement à ce message. Merci pour votre confiance, et à bientôt."
        : "Pour toute question, répondez simplement à ce message.";

  return emailDepuisContenu(subject, {
    titre: `${libelle} ${args.numero}`,
    apercu: `${libelle} ${args.numero} · ${args.totalText}`,
    salutation: `Bonjour ${args.clientNom},`,
    paragraphes,
    resume,
    messagePerso: args.messagePerso,
    conclusion,
    signature: sig(args.signature, args.expediteurNom),
  });
}

/**
 * E-mail d'envoi d'un bon d'intervention (PDF joint) au client.
 */
export function buildBonInterventionEmail(args: {
  clientNom: string;
  expediteurNom: string;
  dateText: string;
  messagePerso?: string;
  signature?: SignatureEmail;
}): { subject: string; html: string; text: string } {
  const subject = `Bon d'intervention du ${args.dateText}${args.expediteurNom ? " — " + args.expediteurNom : ""}`;
  return emailDepuisContenu(subject, {
    titre: `Bon d'intervention du ${args.dateText}`,
    salutation: `Bonjour ${args.clientNom},`,
    paragraphes: [
      `Veuillez trouver ci-joint le bon d'intervention du ${args.dateText}, qui récapitule les travaux réalisés chez vous.`,
    ],
    messagePerso: args.messagePerso,
    conclusion: "Pour toute question, répondez simplement à ce message.",
    signature: sig(args.signature, args.expediteurNom),
  });
}

/**
 * Relance pour facture impayée. Ton ferme mais courtois.
 */
export function buildRelanceEmail(args: {
  numero: string;
  clientNom: string;
  expediteurNom: string;
  totalText: string;
  /** Reste à régler, s'il diffère du total (acompte encaissé, avoir imputé). */
  resteText?: string;
  echeanceText: string;
  joursRetard: number;
  signature?: SignatureEmail;
}): { subject: string; html: string; text: string } {
  const subject = `Relance — Facture ${args.numero} impayée depuis ${args.joursRetard} jours`;
  const resume: Array<[string, string]> = [
    ["Facture", args.numero],
    ["Montant", args.totalText],
  ];
  if (args.resteText) resume.push(["Reste à régler", args.resteText]);
  resume.push(["Échéance", args.echeanceText]);
  resume.push(["Retard", `${args.joursRetard} jour${args.joursRetard > 1 ? "s" : ""}`]);
  return emailDepuisContenu(subject, {
    titre: `Rappel — facture ${args.numero}`,
    apercu: `Facture ${args.numero} en attente de règlement`,
    salutation: `Bonjour ${args.clientNom},`,
    paragraphes: [
      `Sauf erreur de ma part, la facture ${args.numero} dont l'échéance était fixée au ${args.echeanceText} n'a pas encore été réglée.`,
      "Pourriez-vous procéder au règlement dans les meilleurs délais ? Les coordonnées bancaires figurent sur la facture.",
      "Si le paiement a été effectué entre-temps, merci de ne pas tenir compte de ce message et de m'indiquer la date du règlement.",
    ],
    resume,
    signature: sig(args.signature, args.expediteurNom),
  });
}

/**
 * Invitation à signer un contrat d'entretien (lien public).
 */
export function buildLienContratEmail(args: {
  clientNom: string;
  expediteurNom: string;
  numero: string;
  lien: string;
  expireLeText: string;
  signature?: SignatureEmail;
}): { subject: string; html: string; text: string } {
  const subject = `Votre contrat d'entretien ${args.numero} — à signer en ligne${args.expediteurNom ? " — " + args.expediteurNom : ""}`;
  return emailDepuisContenu(subject, {
    titre: `Contrat d'entretien ${args.numero}`,
    apercu: "À lire et signer en ligne, depuis votre téléphone",
    salutation: `Bonjour ${args.clientNom},`,
    paragraphes: [
      `Voici votre contrat d'entretien ${args.numero}. Vous pouvez le lire, compléter vos informations et le signer directement depuis votre téléphone — aucun compte n'est nécessaire.`,
    ],
    bouton: { libelle: "Lire et signer mon contrat", href: args.lien },
    resume: [["Lien valable jusqu'au", args.expireLeText]],
    conclusion: `Une fois signé, vous recevrez immédiatement votre exemplaire en PDF. Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur : ${args.lien}`,
    signature: sig(args.signature, args.expediteurNom),
  });
}

/**
 * E-mail accompagnant le contrat signé (client ET artisan).
 */
export function buildContratSigneEmail(args: {
  destinataireNom: string;
  numero: string;
  signataireNom: string;
  dateSignatureText: string;
  pourArtisan: boolean;
  signature?: SignatureEmail;
}): { subject: string; html: string; text: string } {
  const subject = args.pourArtisan
    ? `✅ Contrat ${args.numero} signé par ${args.signataireNom}`
    : `Votre contrat d'entretien ${args.numero} signé — exemplaire PDF`;
  const signature = sig(args.signature, args.pourArtisan ? NOM_APPLICATION : "Votre artisan");
  return emailDepuisContenu(subject, {
    titre: `Contrat ${args.numero} signé`,
    salutation: args.pourArtisan ? "Bonjour," : `Bonjour ${args.destinataireNom},`,
    paragraphes: args.pourArtisan
      ? [
          `${args.signataireNom} a signé le contrat d'entretien ${args.numero} le ${args.dateSignatureText}.`,
          "L'exemplaire signé (avec sa page de preuve) est en pièce jointe et archivé dans l'application. Pensez à passer le contrat en « actif » et à créer le suivi de maintenance.",
        ]
      : [
          `Merci ! Votre contrat d'entretien ${args.numero} a bien été signé le ${args.dateSignatureText}.`,
          "Vous trouverez en pièce jointe votre exemplaire PDF, à conserver. Il comprend la page de preuve de la signature électronique.",
        ],
    resume: [
      ["Contrat", args.numero],
      ["Signé par", args.signataireNom],
      ["Le", args.dateSignatureText],
    ],
    signature,
  });
}

/**
 * Rappel d'entretien (contrat de maintenance) : on invite le client à
 * prendre rendez-vous.
 */
export function buildRappelEntretienEmail(args: {
  clientNom: string;
  expediteurNom: string;
  /** Libellé du contrat ou de l'équipement (ex. « Entretien clim annuel ») */
  objetEntretien: string;
  /** Date de visite prévue, déjà formatée */
  dateVisiteText: string;
  telephone?: string | null;
  emailPro?: string | null;
  signature?: SignatureEmail;
}): { subject: string; html: string; text: string } {
  const subject = `Rappel d'entretien — ${args.objetEntretien}${args.expediteurNom ? " — " + args.expediteurNom : ""}`;
  const coordonnees = [
    args.telephone ? `par téléphone au ${formatTelephone(args.telephone)}` : null,
    args.emailPro ? `par e-mail à ${args.emailPro}` : null,
  ]
    .filter(Boolean)
    .join(" ou ");
  return emailDepuisContenu(subject, {
    titre: "Votre prochain entretien",
    apercu: `${args.objetEntretien} · vers le ${args.dateVisiteText}`,
    salutation: `Bonjour ${args.clientNom},`,
    paragraphes: [
      `La prochaine visite d'entretien de votre installation est prévue aux alentours du ${args.dateVisiteText}.`,
      "Un entretien régulier garantit le bon fonctionnement et la longévité de votre équipement.",
    ],
    resume: [
      ["Installation", args.objetEntretien],
      ["Période prévue", `vers le ${args.dateVisiteText}`],
    ],
    conclusion: coordonnees
      ? `Pour convenir d'un rendez-vous, vous pouvez me joindre ${coordonnees}, ou simplement répondre à ce message.`
      : "Pour convenir d'un rendez-vous, répondez simplement à ce message.",
    signature: {
      ...sig(args.signature, args.expediteurNom),
      telephone: args.signature?.telephone ?? args.telephone,
      email: args.signature?.email ?? args.emailPro,
    },
  });
}

/**
 * Avis de reconduction « loi Chatel » (art. L. 215-1 et suivants du
 * code de la consommation) — client PARTICULIER uniquement.
 *
 * Le texte reprend l'information exigée par l'article 7 du contrat
 * type : faculté de ne pas reconduire, date d'échéance, préavis de
 * deux mois par lettre recommandée, et conséquence d'un défaut
 * d'information. Le contrat type lui-même (lib/contrats/template-v1)
 * n'est PAS modifié — ce message le rappelle, il ne le remplace pas.
 */
export function buildAvisChatelEmail(args: {
  clientNom: string;
  expediteurNom: string;
  /** Numéro du contrat (ex. « 2026-001 ») */
  numero: string;
  /** Échéance annuelle, déjà formatée */
  dateEcheanceText: string;
  /** Date limite de dénonciation (échéance − 2 mois), déjà formatée */
  dateLimiteText: string;
  telephone?: string | null;
  emailPro?: string | null;
  /** Copie destinée à l'artisan (récapitulatif) plutôt qu'au client */
  pourArtisan?: boolean;
  signature?: SignatureEmail;
}): { subject: string; html: string; text: string } {
  const subject = args.pourArtisan
    ? `Copie — avis de reconduction envoyé (contrat ${args.numero})`
    : `Votre contrat d'entretien ${args.numero} — reconduction annuelle`;
  const coordonnees = [
    args.telephone ? `par téléphone au ${formatTelephone(args.telephone)}` : null,
    args.emailPro ? `par e-mail à ${args.emailPro}` : null,
  ]
    .filter(Boolean)
    .join(" ou ");

  // Mention de franchise : valeur centralisée dans lib/legal-text,
  // jamais écrite en dur ici. Sans argument, elle prend la date du
  // jour — c'est la bonne : ce pied de page décrit le régime de
  // l'expéditeur au moment où le message part, pas celui d'un
  // document passé. Le gabarit l'échappe en HTML et la garde telle
  // quelle en texte (vérifié par lib/email-mentions.test.ts).
  const mentionTva = mentionTvaFranchise();

  return emailDepuisContenu(subject, {
    titre: `Contrat ${args.numero} — reconduction annuelle`,
    bandeau: args.pourArtisan
      ? `Copie de l'avis envoyé au client ${args.clientNom}. Aucune action de votre part n'est nécessaire.`
      : null,
    salutation: `Bonjour ${args.clientNom},`,
    paragraphes: [
      `Votre contrat d'entretien n° ${args.numero} arrive à son échéance annuelle le ${args.dateEcheanceText}. Sauf opposition de votre part, il sera reconduit pour un an.`,
      `Conformément aux articles L. 215-1 et suivants du code de la consommation, je vous informe que vous pouvez choisir de ne pas le reconduire. Pour cela, adressez-moi une lettre recommandée avec accusé de réception au plus tard le ${args.dateLimiteText}, soit deux mois avant l'échéance.`,
      "Si vous souhaitez au contraire poursuivre, vous n'avez aucune démarche à faire.",
    ],
    resume: [
      ["Contrat", args.numero],
      ["Échéance annuelle", args.dateEcheanceText],
      ["Dénonciation possible jusqu'au", args.dateLimiteText],
    ],
    conclusion: coordonnees
      ? `Pour toute question, vous pouvez me joindre ${coordonnees}, ou simplement répondre à ce message.`
      : "Pour toute question, répondez simplement à ce message.",
    signature: {
      ...sig(args.signature, args.expediteurNom),
      telephone: args.signature?.telephone ?? args.telephone,
      email: args.signature?.email ?? args.emailPro,
    },
    mentionPied: mentionTva,
  });
}
