import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { createServiceClient } from "@/lib/supabase/service";
import { aujourdhuiParis } from "@/lib/dates";
import { buildEmetteurSnapshot } from "@/lib/emetteur";
import { signatureDevisPubliqueSchema } from "@/lib/devis-public";
import { getDevisParToken, rendrePdfDevisPublic } from "@/lib/devis/public";
import { buildDevisSigneArtisanEmail, buildDocumentEmail, isEmailConfigured, sendEmail, signatureDepuisProfil } from "@/lib/email";
import { envoyerNotification, pushConfigure } from "@/lib/push/envoi";
import { formatDateFr, formatEuros } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIGNATURE_BYTES = 500 * 1024;

/**
 * Signature PUBLIQUE d'un devis par le client (aucun compte) : jeton
 * résolu au service role, état du lien revérifié, nom + case « bon pour
 * accord » + PNG de signature exigés, archivage dans le bucket immuable
 * `signatures`, passage en « accepté » gardé contre la double signature
 * (colonne écrite une seule fois), faisceau de preuves (horodatage
 * serveur, IP, navigateur), mentions émetteur figées, exemplaire signé
 * envoyé au client, artisan prévenu (e-mail + notification).
 */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ ok: false, error: "Lien invalide." }, { status: 404 });
  }
  let pub;
  try {
    pub = await getDevisParToken(token);
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "devis/signer", etape: "lecture" } });
    return NextResponse.json({ ok: false, error: "Service momentanément indisponible." }, { status: 503 });
  }
  if (pub.etat === "indisponible") {
    return NextResponse.json({ ok: false, error: "Service momentanément indisponible — réessayez dans quelques minutes." }, { status: 503 });
  }
  if (pub.etat !== "utilisable" || !pub.devis) {
    const messages: Record<string, string> = {
      signe: "Ce devis est déjà signé.",
      expire: "Ce lien a expiré : le devis n'est plus valable, contactez votre artisan.",
      revoque: "Ce lien n'est plus valide.",
      introuvable: "Lien invalide.",
    };
    return NextResponse.json({ ok: false, error: messages[pub.etat] ?? "Lien invalide." }, { status: 410 });
  }
  const devis = pub.devis;

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = signatureDevisPubliqueSchema.safeParse({
    signataire_nom: fd.get("signataire_nom"),
    accepte: fd.get("accepte") === "oui",
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." }, { status: 400 });
  }
  const signature = fd.get("signature");
  if (!(signature instanceof File) || signature.size === 0) {
    return NextResponse.json({ ok: false, error: "Signature manquante — signez dans le cadre." }, { status: 400 });
  }
  if (signature.size > MAX_SIGNATURE_BYTES) {
    return NextResponse.json({ ok: false, error: "Signature trop lourde." }, { status: 400 });
  }
  if (signature.type !== "image/png") {
    return NextResponse.json({ ok: false, error: "Format de signature invalide." }, { status: 400 });
  }

  const service = createServiceClient();
  const nowIso = new Date().toISOString();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "inconnue";
  const userAgent = (req.headers.get("user-agent") ?? "inconnu").slice(0, 500);

  const signaturePath = `${devis.user_id}/devis/${devis.id}/bon-pour-accord-en-ligne-${Date.now()}.png`;
  const { error: uploadErr } = await service.storage.from("signatures").upload(signaturePath, signature, { contentType: "image/png", upsert: false });
  if (uploadErr) {
    Sentry.captureException(uploadErr, { tags: { route: "devis/signer", etape: "upload" } });
    return NextResponse.json({ ok: false, error: "Impossible d'enregistrer la signature, réessayez." }, { status: 500 });
  }

  // Mentions émetteur figées en même temps que la signature (devis engageant).
  const emetteur = devis.emetteur ?? buildEmetteurSnapshot(pub.profil) ?? null;
  const { data: signe, error: updateErr } = await service
    .from("devis")
    .update({
      signature_client_url: signaturePath,
      signataire_nom: parsed.data.signataire_nom,
      date_signature: aujourdhuiParis(),
      signe_le: nowIso,
      signature_ip: ip,
      signature_user_agent: userAgent,
      signature_origine: "en_ligne",
      statut: "accepte",
      ...(emetteur ? { emetteur } : {}),
    })
    .eq("id", devis.id)
    .eq("access_token", token)
    .is("signature_client_url", null)
    .select("id");
  if (updateErr || !signe || signe.length === 0) {
    await service.storage.from("signatures").remove([signaturePath]);
    return NextResponse.json({ ok: false, error: "Ce devis vient déjà d'être signé." }, { status: 409 });
  }

  // La signature est ACQUISE : la suite est en meilleur effort.
  const anomalies: string[] = [];
  try {
    const apres = await getDevisParToken(token);
    const expediteurNom = apres.prestataireNom;
    const dateSignatureText = new Date(nowIso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" });
    if (isEmailConfigured() && apres.devis) {
      const pdf = await rendrePdfDevisPublic(apres);
      const piece = { filename: `${apres.devis.numero}-signe.pdf`, content: pdf, contentType: "application/pdf" };
      if (apres.client?.email) {
        const emailClient = buildDocumentEmail({
          type: "devis",
          numero: apres.devis.numero,
          clientNom: apres.client.nom,
          expediteurNom,
          totalText: formatEuros(Number(apres.devis.total_ht)),
          signeLe: formatDateFr(apres.devis.date_signature ?? aujourdhuiParis()),
          dateText: formatDateFr(apres.devis.date_emission),
          natureActivite: apres.devis.type_activite,
          acompteText: apres.acompteText ?? undefined,
          signature: signatureDepuisProfil(apres.profil, expediteurNom),
        });
        const envoi = await sendEmail({
          to: apres.client.email,
          subject: emailClient.subject,
          html: emailClient.html,
          text: emailClient.text,
          replyTo: apres.profil?.email_pro ?? undefined,
          fromName: expediteurNom,
          attachments: [piece],
        });
        if (!envoi.ok) anomalies.push(`e-mail au client : ${envoi.error}`);
      }
      if (apres.profil?.email_pro) {
        const emailArtisan = buildDevisSigneArtisanEmail({
          numero: apres.devis.numero,
          clientNom: apres.client?.nom ?? "Le client",
          signataireNom: parsed.data.signataire_nom,
          dateSignatureText,
          totalText: formatEuros(Number(apres.devis.total_ht)),
          acompteText: apres.acompteText,
          lienFiche: `/devis/${apres.devis.id}`,
        });
        const envoi = await sendEmail({ to: apres.profil.email_pro, subject: emailArtisan.subject, html: emailArtisan.html, text: emailArtisan.text, attachments: [piece] });
        if (!envoi.ok) anomalies.push(`e-mail à l'artisan : ${envoi.error}`);
      }
    }
    if (pushConfigure()) {
      const { data: abonnements } = await service.from("push_abonnements").select("endpoint, p256dh, auth").eq("user_id", devis.user_id);
      for (const a of abonnements ?? []) {
        const r = await envoyerNotification(a, {
          titre: `Devis ${devis.numero} signé`,
          corps: `${parsed.data.signataire_nom} a signé en ligne — ${formatEuros(Number(devis.total_ht))}.`,
          url: `/devis/${devis.id}`,
          tag: `devis-${devis.id}`,
        });
        if (r.resultat === "expire") await service.from("push_abonnements").delete().eq("endpoint", a.endpoint).eq("user_id", devis.user_id);
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "devis/signer", etape: "suite" } });
    anomalies.push(e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({ ok: true, anomalies });
}
