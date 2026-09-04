import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { ContratPdf } from "@/components/contrats/contrat-pdf";
import {
  chargerLogoDataUri,
  chargerSignatureDataUri,
  construirePreuve,
} from "@/lib/contrats/pdf-helpers";
import {
  prestataireEffectif,
  type ClientSnapshot,
} from "@/lib/contrats/rendu";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aperçu / téléchargement du PDF d'un contrat — ADMIN (session
 * requise, RLS). Brouillon : coordonnées courantes, filigrane implicite
 * (pas de numéro). Signé : signature + page de preuve avec l'empreinte
 * archivée.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const [contratRes, profilRes] = await Promise.all([
    supabase
      .from("contrats")
      .select("*, client:clients(*)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("profil_entreprise")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!contratRes.data) {
    return new NextResponse("Contrat introuvable", { status: 404 });
  }

  type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
  const { client, ...contrat } = contratRes.data as typeof contratRes.data & {
    client: ClientRow | null;
  };

  const prestataire = prestataireEffectif(
    profilRes.data ?? null,
    contrat.prestataire,
  );

  let clientSnapshot: ClientSnapshot;
  if (contrat.client_snapshot && typeof contrat.client_snapshot === "object") {
    clientSnapshot = contrat.client_snapshot as ClientSnapshot;
  } else {
    clientSnapshot = client
      ? {
          nom: client.nom,
          raison_sociale: client.raison_sociale,
          adresse: [
            client.adresse_ligne1,
            client.adresse_ligne2,
            [client.code_postal, client.ville].filter(Boolean).join(" "),
          ]
            .filter(Boolean)
            .join(", "),
          telephone: client.telephone,
          email: client.email,
          siret: client.siret,
        }
      : {};
  }

  const [logoData, signatureData] = await Promise.all([
    chargerLogoDataUri(supabase, profilRes.data?.logo_url),
    chargerSignatureDataUri(supabase, contrat.signature_path),
  ]);

  const stream = await renderToStream(
    ContratPdf({
      contrat,
      prestataire,
      clientSnapshot,
      logoData,
      signatureData,
      preuve: contrat.signed_at
        ? construirePreuve(contrat, contrat.pdf_sha256)
        : null,
    }),
  );

  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err: Error) => controller.error(err));
    },
  });

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrat-${contrat.numero ?? "brouillon"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
