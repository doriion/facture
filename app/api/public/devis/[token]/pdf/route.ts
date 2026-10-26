import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { getDevisParToken, rendrePdfDevisPublic } from "@/lib/devis/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PDF PUBLIC du devis, par le même jeton que la page de signature :
 * lisible tant que le lien est utilisable, puis 30 jours après la
 * signature (l'exemplaire signé a été envoyé par e-mail).
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!token || token.length < 16) return new NextResponse("Lien invalide", { status: 404 });
  try {
    const pub = await getDevisParToken(token);
    if (pub.etat === "indisponible") return new NextResponse("Service momentanément indisponible", { status: 503 });
    if (!pub.devis || (pub.etat !== "utilisable" && pub.etat !== "signe")) {
      return new NextResponse("Document indisponible", { status: 404 });
    }
    if (pub.etat === "signe" && pub.devis.signe_le && Date.now() - new Date(pub.devis.signe_le).getTime() > 30 * 24 * 3600 * 1000) {
      return new NextResponse("Lien expiré : le devis signé vous a été envoyé par e-mail.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    const pdf = await rendrePdfDevisPublic(pub);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pub.devis.numero}${pub.etat === "signe" ? "-signe" : ""}.pdf"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { route: "devis/pdf" } });
    return new NextResponse("Service momentanément indisponible", { status: 503 });
  }
}
