import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { createServiceClient } from "@/lib/supabase/service";
import { libelleReserves, signatureFichePubliqueSchema } from "@/lib/fiches-gaz";
import { getFicheParToken } from "@/lib/fiches-gaz/public";
import { archiverBonFiche, archiverCerfaFiche, piecesJointesFiche } from "@/lib/fiches-gaz/documents";
import { buildFicheGazEmail, buildFicheSigneeArtisanEmail, isEmailConfigured, sendEmail, signatureDepuisProfil } from "@/lib/email";
import { envoyerNotification, pushConfigure } from "@/lib/push/envoi";
import { formatDateFr } from "@/lib/format";
import { baseUrlPublique } from "@/lib/url-publique";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIGNATURE_BYTES = 500 * 1024;

/**
 * Signature PUBLIQUE de la fiche gaz par le détenteur (aucun compte) :
 * jeton résolu au service role, état du lien revérifié, nom + réserves
 * (sans / avec + détail) + PNG de signature exigés. La signature entre
 * dans `intervention_signatures` (rôle détenteur, immuable, faisceau de
 * preuves dans la qualité : horodatage, IP, navigateur), les réserves
 * sont reportées sur la fiche, puis CERFA et bon de réception sont
 * régénérés, archivés, envoyés au client et à l'artisan (e-mail + push).
 */
export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!token || token.length < 16) return NextResponse.json({ ok: false, error: "Lien invalide." }, { status: 404 });
  let pub;
  try {
    pub = await getFicheParToken(token);
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "fiches/signer", etape: "lecture" } });
    return NextResponse.json({ ok: false, error: "Service momentanément indisponible." }, { status: 503 });
  }
  if (pub.etat === "indisponible") {
    return NextResponse.json({ ok: false, error: "Service momentanément indisponible — réessayez dans quelques minutes." }, { status: 503 });
  }
  if (pub.etat !== "utilisable" || !pub.fiche) {
    const messages: Record<string, string> = {
      signe: "Cette fiche est déjà signée.",
      expire: "Ce lien a expiré : demandez un nouveau lien à votre artisan.",
      introuvable: "Lien invalide.",
    };
    return NextResponse.json({ ok: false, error: messages[pub.etat] ?? "Lien invalide." }, { status: 410 });
  }
  const { intervention } = pub.fiche;

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }
  const parsed = signatureFichePubliqueSchema.safeParse({
    signataire_nom: fd.get("signataire_nom"),
    signataire_qualite: fd.get("signataire_qualite") ?? "",
    bon_reserves: fd.get("bon_reserves"),
    bon_reserves_texte: fd.get("bon_reserves_texte") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." }, { status: 400 });
  }
  if (parsed.data.bon_reserves === "avec" && !(parsed.data.bon_reserves_texte ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "Décrivez vos réserves, ou choisissez « Sans réserve »." }, { status: 400 });
  }
  const signature = fd.get("signature");
  if (!(signature instanceof File) || signature.size === 0) {
    return NextResponse.json({ ok: false, error: "Signature manquante — signez dans le cadre." }, { status: 400 });
  }
  if (signature.size > MAX_SIGNATURE_BYTES) return NextResponse.json({ ok: false, error: "Signature trop lourde." }, { status: 400 });
  if (signature.type !== "image/png") return NextResponse.json({ ok: false, error: "Format de signature invalide." }, { status: 400 });

  const service = createServiceClient();
  const nowIso = new Date().toISOString();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "inconnue";
  const userAgent = (req.headers.get("user-agent") ?? "inconnu").slice(0, 160);

  // Garde contre la double signature : une seule signature détenteur
  // depuis la demande en ligne.
  const { data: deja } = await service.from("intervention_signatures").select("id").eq("intervention_id", intervention.id).eq("role", "detenteur").limit(1);
  if (deja && deja.length > 0) return NextResponse.json({ ok: false, error: "Cette fiche vient déjà d'être signée." }, { status: 409 });

  const signaturePath = `${intervention.user_id}/${intervention.id}/signature-detenteur-en-ligne-${Date.now()}.png`;
  const { error: uploadErr } = await service.storage.from("signatures").upload(signaturePath, signature, { contentType: "image/png", upsert: false });
  if (uploadErr) {
    Sentry.captureException(uploadErr, { tags: { route: "fiches/signer", etape: "upload" } });
    return NextResponse.json({ ok: false, error: "Impossible d'enregistrer la signature, réessayez." }, { status: 500 });
  }
  const qualite = [parsed.data.signataire_qualite?.trim() || "Détenteur", `signé en ligne · IP ${ip} · ${userAgent}`].join(" — ").slice(0, 200);
  const { error: insertErr } = await service.from("intervention_signatures").insert({
    user_id: intervention.user_id,
    intervention_id: intervention.id,
    role: "detenteur",
    signataire_nom: parsed.data.signataire_nom.slice(0, 200),
    signataire_qualite: qualite,
    storage_path: signaturePath,
    signe_le: nowIso,
  });
  if (insertErr) {
    Sentry.captureException(insertErr, { tags: { route: "fiches/signer", etape: "insert" } });
    return NextResponse.json({ ok: false, error: "Impossible d'enregistrer la signature, réessayez." }, { status: 500 });
  }
  await service
    .from("interventions")
    .update({
      bon_reserves: parsed.data.bon_reserves,
      bon_reserves_texte: parsed.data.bon_reserves === "avec" ? (parsed.data.bon_reserves_texte ?? "").trim() : null,
    })
    .eq("id", intervention.id)
    .eq("signature_token", token);

  // La signature est ACQUISE : la suite est en meilleur effort.
  const anomalies: string[] = [];
  try {
    const apres = await getFicheParToken(token);
    if (apres.fiche) {
      const fiche = apres.fiche;
      const [cerfa, bon] = [await archiverCerfaFiche(service, fiche), await archiverBonFiche(service, fiche)];
      const expediteurNom = apres.prestataireNom;
      const dateText = formatDateFr(fiche.intervention.date_intervention);
      const pieces = piecesJointesFiche(fiche, cerfa.buffer, bon.buffer);
      const reservesText = libelleReserves(fiche.intervention.bon_reserves, fiche.intervention.bon_reserves_texte);
      if (isEmailConfigured()) {
        if (fiche.client?.email) {
          const emailClient = buildFicheGazEmail({
            clientNom: fiche.client.nom,
            expediteurNom,
            dateText,
            ficheNumero: fiche.intervention.fiche_numero,
            equipementText: apres.equipementText,
            signature: signatureDepuisProfil(fiche.profil, expediteurNom),
          });
          const envoi = await sendEmail({
            to: fiche.client.email,
            subject: emailClient.subject,
            html: emailClient.html,
            text: emailClient.text,
            replyTo: fiche.profil?.email_pro ?? undefined,
            fromName: expediteurNom,
            attachments: pieces,
          });
          if (envoi.ok) await service.from("intervention_bons").update({ envoye_le: new Date().toISOString(), destinataire: fiche.client.email }).eq("id", bon.id);
          else anomalies.push(`e-mail au client : ${envoi.error}`);
        }
        if (fiche.profil?.email_pro) {
          const emailArtisan = buildFicheSigneeArtisanEmail({
            clientNom: fiche.client?.nom ?? "Le client",
            signataireNom: parsed.data.signataire_nom,
            dateSignatureText: new Date(nowIso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }),
            ficheNumero: fiche.intervention.fiche_numero,
            reservesText,
            lienFiche: `${await baseUrlPublique()}/fiches-gaz/${fiche.intervention.id}`,
          });
          const envoi = await sendEmail({ to: fiche.profil.email_pro, subject: emailArtisan.subject, html: emailArtisan.html, text: emailArtisan.text, attachments: pieces });
          if (!envoi.ok) anomalies.push(`e-mail à l'artisan : ${envoi.error}`);
        }
      }
      if (pushConfigure()) {
        const { data: abonnements } = await service.from("push_abonnements").select("endpoint, p256dh, auth").eq("user_id", intervention.user_id);
        for (const a of abonnements ?? []) {
          const r = await envoyerNotification(a, {
            titre: `Fiche gaz${fiche.intervention.fiche_numero ? ` n° ${fiche.intervention.fiche_numero}` : ""} signée`,
            corps: `${parsed.data.signataire_nom} a signé en ligne — ${reservesText}.`,
            url: `/fiches-gaz/${intervention.id}`,
            tag: `fiche-gaz-${intervention.id}`,
          });
          if (r.resultat === "expire") await service.from("push_abonnements").delete().eq("endpoint", a.endpoint).eq("user_id", intervention.user_id);
        }
      }
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "fiches/signer", etape: "suite" } });
    anomalies.push(e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({ ok: true, anomalies });
}
