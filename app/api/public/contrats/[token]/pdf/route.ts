import { NextResponse, type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Téléchargement PUBLIC du PDF signé, par le même token que la page de
 * signature : disponible uniquement une fois le contrat signé (le
 * token ne permet plus aucune modification). Sert le fichier archivé
 * tel quel — celui dont l'empreinte est enregistrée.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  const token = params.token;
  if (!token || token.length < 16) {
    return new NextResponse("Lien invalide", { status: 404 });
  }

  const service = createServiceClient();
  const { data: contrat } = await service
    .from("contrats")
    .select("statut, numero, pdf_path")
    .eq("access_token", token)
    .maybeSingle();

  if (!contrat || !contrat.pdf_path || contrat.statut === "envoye") {
    return new NextResponse("Document indisponible", { status: 404 });
  }

  const { data: blob } = await service.storage
    .from("pdfs")
    .download(contrat.pdf_path);
  if (!blob) return new NextResponse("Document indisponible", { status: 404 });

  return new NextResponse(await blob.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrat-${contrat.numero ?? "entretien"}-signe.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
