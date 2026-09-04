import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { etatLienPublic, retractationApplicable } from "@/lib/contrats/logic";
import {
  prestataireEffectif,
  nomAffichagePrestataire,
  type ClientSnapshot,
} from "@/lib/contrats/rendu";
import {
  chargerLogoDataUri,
  chargerSignatureDataUri,
  rendreContratSigne,
} from "@/lib/contrats/pdf-helpers";
import { contratSignatureSchema } from "@/lib/validations/contrat-signature";
import { buildContratSigneEmail, isEmailConfigured, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIGNATURE_BYTES = 500 * 1024;

/**
 * Signature PUBLIQUE d'un contrat par le client (aucun compte).
 * Toute la sécurité est côté serveur : token résolu au service role,
 * état du lien revérifié, champs revalidés (Zod), consentements
 * exigés, update gardé contre la double signature, faisceau de
 * preuves (horodatage serveur, IP, user-agent), PDF signé en deux
 * passes avec empreinte SHA-256, archivage immuable, emails aux deux
 * parties.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!token || token.length < 16) {
    return NextResponse.json(
      { ok: false, error: "Lien invalide." },
      { status: 404 },
    );
  }

  const service = createServiceClient();
  const { data: contratData } = await service
    .from("contrats")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();

  const etat = etatLienPublic(contratData ?? null, new Date().toISOString());
  if (etat !== "utilisable" || !contratData) {
    const messages: Record<string, string> = {
      "deja-signe": "Ce contrat est déjà signé.",
      expire: "Ce lien de signature a expiré.",
      revoque: "Ce lien n'est plus valide.",
      introuvable: "Lien invalide.",
    };
    return NextResponse.json(
      { ok: false, error: messages[etat] ?? "Lien invalide." },
      { status: 410 },
    );
  }
  const contrat = contratData;

  // --- Validation de la saisie client -----------------------------------
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Requête invalide." },
      { status: 400 },
    );
  }

  const parsed = contratSignatureSchema.safeParse({
    nom: fd.get("nom"),
    adresse: fd.get("adresse"),
    telephone: fd.get("telephone") ?? "",
    email: fd.get("email"),
    siret: fd.get("siret") ?? "",
    occupant: fd.get("occupant"),
    contact_site: fd.get("contact_site") ?? "",
    signataire_qualite: fd.get("signataire_qualite") ?? "",
    accepte_contrat: fd.get("accepte_contrat") === "oui",
    accepte_retractation: fd.get("accepte_retractation") === "oui",
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Saisie invalide.",
      },
      { status: 400 },
    );
  }
  const saisie = parsed.data;

  const retractation = retractationApplicable({
    qualiteClient:
      contrat.qualite_client === "professionnel"
        ? "professionnel"
        : "particulier",
    modeConclusion:
      contrat.mode_conclusion === "presentiel"
        ? "presentiel"
        : contrat.mode_conclusion === "hors_etablissement"
          ? "hors_etablissement"
          : "distance",
  });
  if (retractation && !saisie.accepte_retractation) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Cochez la case attestant que vous avez pris connaissance de votre droit de rétractation.",
      },
      { status: 400 },
    );
  }

  const signature = fd.get("signature");
  if (!(signature instanceof File) || signature.size === 0) {
    return NextResponse.json(
      { ok: false, error: "Signature manquante — signez dans le cadre." },
      { status: 400 },
    );
  }
  if (signature.size > MAX_SIGNATURE_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Signature trop lourde." },
      { status: 400 },
    );
  }
  if (signature.type !== "image/png") {
    return NextResponse.json(
      { ok: false, error: "Format de signature invalide." },
      { status: 400 },
    );
  }

  // --- Faisceau de preuves ----------------------------------------------
  const nowIso = new Date().toISOString();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "inconnue";
  const userAgent = (req.headers.get("user-agent") ?? "inconnu").slice(0, 500);

  // --- Archivage de la signature (bucket immuable `signatures`) ---------
  const signaturePath = `${contrat.user_id}/contrats/${contrat.id}/signature-${Date.now()}.png`;
  const { error: uploadErr } = await service.storage
    .from("signatures")
    .upload(signaturePath, signature, {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json(
      { ok: false, error: "Impossible d'enregistrer la signature, réessayez." },
      { status: 500 },
    );
  }

  const clientSnapshotExistant: ClientSnapshot =
    contrat.client_snapshot && typeof contrat.client_snapshot === "object"
      ? (contrat.client_snapshot as ClientSnapshot)
      : {};
  const clientSnapshot: ClientSnapshot = {
    ...clientSnapshotExistant,
    nom: saisie.nom,
    adresse: saisie.adresse,
    telephone: saisie.telephone || clientSnapshotExistant.telephone || null,
    email: saisie.email,
    siret: saisie.siret || clientSnapshotExistant.siret || null,
  };

  // --- Passage en « signé », gardé contre la double signature ------------
  const { data: signee, error: updateErr } = await service
    .from("contrats")
    .update({
      statut: "signe",
      client_snapshot: clientSnapshot,
      occupant: saisie.occupant,
      contact_site: saisie.contact_site || null,
      signataire_nom: saisie.nom,
      signature_path: signaturePath,
      signature_ip: ip,
      signature_user_agent: userAgent,
      signed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", contrat.id)
    .eq("statut", "envoye")
    .is("signature_path", null)
    .select("*")
    .single();

  if (updateErr || !signee) {
    // Course perdue (double clic / double onglet) : nettoie le fichier
    await service.storage.from("signatures").remove([signaturePath]);
    return NextResponse.json(
      { ok: false, error: "Ce contrat vient déjà d'être signé." },
      { status: 409 },
    );
  }

  // --- PDF signé (2 passes, SHA-256) + archivage + emails ----------------
  // La signature est ACQUISE à ce stade : les étapes suivantes sont en
  // best-effort (le PDF peut être régénéré depuis l'admin).
  try {
    const prestataire = prestataireEffectif(null, signee.prestataire);

    const { data: profil } = await service
      .from("profil_entreprise")
      .select("logo_url, email_pro")
      .eq("user_id", signee.user_id)
      .maybeSingle();

    const [logoData, signatureData] = await Promise.all([
      chargerLogoDataUri(service, profil?.logo_url),
      chargerSignatureDataUri(service, signaturePath),
    ]);

    const { pdf, sha256 } = await rendreContratSigne({
      contrat: signee,
      prestataire,
      clientSnapshot,
      logoData,
      signatureData,
    });

    const pdfPath = `${signee.user_id}/contrats/${signee.id}/contrat-${signee.numero ?? signee.id}-signe.pdf`;
    const { error: pdfErr } = await service.storage
      .from("pdfs")
      .upload(pdfPath, pdf, {
        contentType: "application/pdf",
        upsert: true,
      });

    await service
      .from("contrats")
      .update({
        pdf_path: pdfErr ? null : pdfPath,
        pdf_sha256: sha256,
        updated_at: new Date().toISOString(),
      })
      .eq("id", signee.id);

    if (isEmailConfigured()) {
      const dateSignatureText = new Date(nowIso).toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
        dateStyle: "long",
        timeStyle: "short",
      });
      const piece = {
        filename: `contrat-${signee.numero ?? "entretien"}-signe.pdf`,
        content: pdf,
        contentType: "application/pdf",
      };
      const emailPro = profil?.email_pro ?? prestataire.email_pro ?? null;

      const emailClient = buildContratSigneEmail({
        destinataireNom: saisie.nom,
        numero: signee.numero ?? "",
        signataireNom: saisie.nom,
        dateSignatureText,
        pourArtisan: false,
      });
      await sendEmail({
        to: saisie.email,
        subject: emailClient.subject,
        html: emailClient.html,
        text: emailClient.text,
        replyTo: emailPro ?? undefined,
        attachments: [piece],
      });

      if (emailPro) {
        const emailArtisan = buildContratSigneEmail({
          destinataireNom: nomAffichagePrestataire(prestataire),
          numero: signee.numero ?? "",
          signataireNom: saisie.nom,
          dateSignatureText,
          pourArtisan: true,
        });
        await sendEmail({
          to: emailPro,
          subject: emailArtisan.subject,
          html: emailArtisan.html,
          text: emailArtisan.text,
          attachments: [piece],
        });
      }
    }
  } catch (e) {
    // Signature valide malgré tout — Sentry attrapera l'erreur serveur.
    console.error("Post-signature contrat :", e);
  }

  return NextResponse.json({ ok: true });
}
