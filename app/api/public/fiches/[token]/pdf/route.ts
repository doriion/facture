import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { createServiceClient } from "@/lib/supabase/service";
import { getFicheParToken } from "@/lib/fiches-gaz/public";
import { rendreBonFiche, rendreCerfaFiche } from "@/lib/fiches-gaz/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * PDF PUBLIC d'une fiche gaz (?doc=cerfa ou ?doc=bon), par le jeton de
 * la page de signature : lisible tant que le lien est utilisable, puis
 * 30 jours après la signature (les exemplaires signés ont été envoyés
 * par e-mail). Rendu à la demande, avec les signatures du moment.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!token || token.length < 16) return new NextResponse("Lien invalide", { status: 404 });
  const doc = req.nextUrl.searchParams.get("doc") === "bon" ? "bon" : "cerfa";
  try {
    const pub = await getFicheParToken(token);
    if (pub.etat === "indisponible") return new NextResponse("Service momentanément indisponible", { status: 503 });
    if (!pub.fiche || (pub.etat !== "utilisable" && pub.etat !== "signe")) {
      return new NextResponse("Document indisponible", { status: 404 });
    }
    if (pub.etat === "signe" && pub.detenteur && Date.now() - new Date(pub.detenteur.signe_le).getTime() > 30 * 24 * 3600 * 1000) {
      return new NextResponse("Lien expiré : les documents signés vous ont été envoyés par e-mail.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    const service = createServiceClient();
    const pdf = doc === "bon" ? await rendreBonFiche(service, pub.fiche) : await rendreCerfaFiche(service, pub.fiche);
    const num = pub.fiche.intervention.fiche_numero ? `-${pub.fiche.intervention.fiche_numero}` : "";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${doc === "bon" ? "bon-reception" : "cerfa-15497"}${num}.pdf"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "fiches/pdf" } });
    return new NextResponse("Service momentanément indisponible", { status: 503 });
  }
}
