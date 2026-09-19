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

  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (e) {
    console.error("PDF public contrat — service indisponible :", e);
    return new NextResponse("Service momentanément indisponible", {
      status: 503,
    });
  }
  const { data: contrat } = await service
    .from("contrats")
    .select("statut, numero, pdf_path, signed_at")
    .eq("access_token", token)
    .maybeSingle();

  if (!contrat || !contrat.pdf_path || contrat.statut === "envoye") {
    return new NextResponse("Document indisponible", { status: 404 });
  }
  // Le lien de téléchargement ne vaut que 30 jours après la signature :
  // le PDF (avec la page de preuve) a été envoyé par email, un lien
  // éternel n'a pas lieu d'être.
  if (contrat.signed_at && Date.now() - new Date(contrat.signed_at).getTime() > 30 * 24 * 3600 * 1000) {
    return new NextResponse("Lien expiré : le contrat signé vous a été envoyé par email.", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
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
