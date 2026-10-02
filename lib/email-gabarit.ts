/**
 * Gabarit commun des e-mails envoyés aux clients (et à l'artisan) :
 * bandeau aux couleurs de l'entreprise, carte blanche, encadré de
 * résumé (document, montant, échéance), message personnel mis en
 * valeur, signature complète (téléphone, e-mail, adresse, SIRET) et
 * pied discret. Tout est en tableaux et styles en ligne : c'est ce que
 * Gmail, Outlook et Apple Mail rendent de façon fiable. Logique pure,
 * testée : le HTML et la version texte sortent du même contenu.
 */

import { BORDURE, FOND_PALE, PRINCIPAL, TEXTE, TEXTE_DOUX } from "@/lib/theme";
import { NOM_APPLICATION } from "@/lib/marque";
import { formatTelephone, lienTelephone } from "@/lib/format";

export type SignatureEmail = {
  nom: string;
  /** Activité ou rôle sous le nom (ex. « Plombier chauffagiste »), facultatif. */
  sousTitre?: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  siret?: string | null;
};

export type ContenuEmail = {
  /** Titre du bandeau (ex. « Devis D-2026-0026 »). */
  titre: string;
  /** Texte d'aperçu (affiché par les messageries sous l'objet). */
  apercu?: string;
  salutation: string;
  /** Paragraphes du corps, en texte brut (échappés ici). */
  paragraphes: string[];
  /** Encadré de résumé : libellé → valeur (texte brut). */
  resume?: Array<[string, string]>;
  /** Bouton d'action (lien absolu). */
  bouton?: { libelle: string; href: string };
  /** Mot personnel de l'artisan, mis en évidence. */
  messagePerso?: string | null;
  /** Phrase de conclusion avant la signature. */
  conclusion?: string;
  signature: SignatureEmail;
  /** Mention sous le pied (ex. franchise de TVA), texte brut. */
  mentionPied?: string | null;
  /** Bandeau d'avertissement en tête (copie interne, information). */
  bandeau?: string | null;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const multiligne = (s: string) => escapeHtml(s).replace(/\n/g, "<br/>");

/** Ligne de signature : texte brut, et lien éventuel (tél. cliquable en HTML). */
type LigneSignature = { prefixe?: string; texte: string; href?: string };

function lignesSignature(s: SignatureEmail): LigneSignature[] {
  const tel = s.telephone?.trim();
  const lignes: Array<LigneSignature | null> = [
    s.sousTitre?.trim() ? { texte: s.sousTitre.trim() } : null,
    tel ? { prefixe: "Tél. ", texte: formatTelephone(tel), href: lienTelephone(tel) ?? undefined } : null,
    s.email?.trim() ? { texte: s.email.trim() } : null,
    s.adresse?.trim() ? { texte: s.adresse.trim() } : null,
    s.siret?.trim() ? { texte: `SIRET ${s.siret.trim()}` } : null,
  ];
  return lignes.filter((l): l is LigneSignature => l !== null);
}

function texteLigneSignature(l: LigneSignature): string {
  return `${l.prefixe ?? ""}${l.texte}`;
}

function htmlLigneSignature(l: LigneSignature): string {
  const texte = escapeHtml(l.texte);
  const corps = l.href
    ? `<a href="${escapeHtml(l.href)}" style="color:inherit;text-decoration:none;">${texte}</a>`
    : texte;
  return `${escapeHtml(l.prefixe ?? "")}${corps}`;
}

/** Version HTML : bandeau, carte, encadré, bouton, signature, pied. */
export function htmlEmail(c: ContenuEmail): string {
  const police = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const paragraphes = c.paragraphes
    .map((p) => `<p style="margin:0 0 14px;${police}font-size:15px;line-height:1.55;color:${TEXTE};">${multiligne(p)}</p>`)
    .join("\n");
  const resume = c.resume?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 18px;border:1px solid ${BORDURE};border-radius:8px;background:${FOND_PALE};border-collapse:separate;">
${c.resume
  .map(
    ([l, v], i) => `<tr><td style="padding:${i === 0 ? 12 : 6}px 14px ${i === c.resume!.length - 1 ? 12 : 6}px;${police}font-size:13px;color:${TEXTE_DOUX};width:42%;">${escapeHtml(l)}</td><td style="padding:${i === 0 ? 12 : 6}px 14px ${i === c.resume!.length - 1 ? 12 : 6}px;${police}font-size:15px;font-weight:600;color:${TEXTE};">${escapeHtml(v)}</td></tr>`,
  )
  .join("\n")}
</table>`
    : "";
  const bouton = c.bouton
    ? `<p style="margin:6px 0 20px;text-align:center;"><a href="${escapeHtml(c.bouton.href)}" style="display:inline-block;background:${PRINCIPAL};color:#ffffff;${police}font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:8px;">${escapeHtml(c.bouton.libelle)}</a></p>`
    : "";
  const perso = c.messagePerso?.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;"><tr><td style="border-left:4px solid ${PRINCIPAL};padding:4px 14px;${police}font-size:15px;line-height:1.55;color:${TEXTE};font-style:italic;">${multiligne(c.messagePerso.trim())}</td></tr></table>`
    : "";
  const conclusion = c.conclusion
    ? `<p style="margin:0 0 18px;${police}font-size:15px;line-height:1.55;color:${TEXTE};">${escapeHtml(c.conclusion)}</p>`
    : "";
  const bandeau = c.bandeau
    ? `<tr><td style="padding:10px 28px;background:#fff7e6;border-bottom:1px solid #fde3b3;${police}font-size:13px;color:#7a4b00;">${escapeHtml(c.bandeau)}</td></tr>`
    : "";
  const signature = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:8px;border-top:1px solid ${BORDURE};">
<tr><td style="padding:16px 0 0;${police}font-size:14px;line-height:1.5;color:${TEXTE};">
<div style="margin-bottom:2px;">Cordialement,</div>
<div style="font-size:16px;font-weight:700;color:${PRINCIPAL};">${escapeHtml(c.signature.nom)}</div>
${lignesSignature(c.signature)
  .map((l) => `<div style="color:${TEXTE_DOUX};font-size:13px;">${htmlLigneSignature(l)}</div>`)
  .join("\n")}
</td></tr></table>`;
  const pied = [c.mentionPied?.trim() || null, `Envoyé avec ${NOM_APPLICATION}`]
    .filter(Boolean)
    .map((l) => `<div>${escapeHtml(l!)}</div>`)
    .join("\n");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${escapeHtml(c.titre)}</title></head>
<body style="margin:0;padding:0;background:#eef2f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(c.apercu ?? c.titre)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#eef2f6;padding:24px 12px;"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDURE};">
<tr><td style="background:${PRINCIPAL};padding:22px 28px;">
<div style="${police}font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:rgba(255,255,255,.8);">${escapeHtml(c.signature.nom)}</div>
<div style="${police}font-size:22px;font-weight:700;color:#ffffff;margin-top:4px;">${escapeHtml(c.titre)}</div>
</td></tr>
${bandeau}
<tr><td style="padding:26px 28px 22px;">
<p style="margin:0 0 14px;${police}font-size:15px;line-height:1.55;color:${TEXTE};">${escapeHtml(c.salutation)}</p>
${paragraphes}
${resume}
${bouton}
${perso}
${conclusion}
${signature}
</td></tr>
<tr><td style="padding:14px 28px 18px;background:#f7f9fb;border-top:1px solid ${BORDURE};${police}font-size:11px;line-height:1.5;color:${TEXTE_DOUX};">
${pied}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Version texte (lecteurs sans HTML, aperçus) : même contenu, même ordre. */
export function texteEmail(c: ContenuEmail): string {
  const blocs: string[] = [];
  if (c.bandeau) blocs.push(c.bandeau);
  blocs.push(c.salutation);
  blocs.push(...c.paragraphes);
  if (c.resume?.length) blocs.push(c.resume.map(([l, v]) => `${l} : ${v}`).join("\n"));
  if (c.bouton) blocs.push(`${c.bouton.libelle} : ${c.bouton.href}`);
  if (c.messagePerso?.trim()) blocs.push(c.messagePerso.trim());
  if (c.conclusion) blocs.push(c.conclusion);
  blocs.push(["Cordialement,", c.signature.nom, ...lignesSignature(c.signature).map(texteLigneSignature)].join("\n"));
  blocs.push([c.mentionPied?.trim() || null, `— Envoyé avec ${NOM_APPLICATION}`].filter(Boolean).join("\n"));
  return blocs.join("\n\n");
}

export function emailDepuisContenu(subject: string, c: ContenuEmail): { subject: string; html: string; text: string } {
  return { subject, html: htmlEmail(c), text: texteEmail(c) };
}

/** Signature à partir du profil entreprise (ou d'un instantané prestataire). */
export function signatureDepuisProfil(
  profil:
    | {
        nom?: string | null;
        prenom?: string | null;
        nom_commercial?: string | null;
        telephone?: string | null;
        email_pro?: string | null;
        adresse_ligne1?: string | null;
        adresse_ligne2?: string | null;
        code_postal?: string | null;
        ville?: string | null;
        siret?: string | null;
      }
    | null
    | undefined,
  nomParDefaut = "Votre artisan",
): SignatureEmail {
  const nom =
    profil?.nom_commercial?.trim() ||
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ").trim() ||
    nomParDefaut;
  const adresse = [profil?.adresse_ligne1, profil?.adresse_ligne2, [profil?.code_postal, profil?.ville].filter(Boolean).join(" ")]
    .map((l) => (l ?? "").trim())
    .filter(Boolean)
    .join(", ");
  return {
    nom,
    telephone: profil?.telephone ?? null,
    email: profil?.email_pro ?? null,
    adresse: adresse || null,
    siret: profil?.siret ?? null,
  };
}
