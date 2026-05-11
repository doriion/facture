import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { FacturePdf } from "@/components/factures/facture-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Génère et streame le PDF d'une facture.
 * Le middleware d'auth gère déjà le 401 — ici on vérifie aussi la propriété
 * (RLS Supabase la garantit, mais on remonte un 404 propre si la facture
 * n'est pas accessible à l'utilisateur).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  const [factureRes, lignesRes, profilRes] = await Promise.all([
    supabase
      .from("factures")
      .select("*, client:clients(*)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("factures_lignes")
      .select("*")
      .eq("facture_id", params.id)
      .order("ordre"),
    supabase
      .from("profil_entreprise")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!factureRes.data) {
    return new NextResponse("Facture introuvable", { status: 404 });
  }

  type FactureWithClient = NonNullable<typeof factureRes.data> & {
    client: Parameters<typeof FacturePdf>[0]["client"];
  };
  const factureRaw = factureRes.data as FactureWithClient;
  const client = factureRaw.client ?? null;

  // Téléchargement du logo (si présent) → data URI pour embed
  let logoData: string | null = null;
  if (profilRes.data?.logo_url) {
    try {
      const { data: blob } = await supabase.storage
        .from("logos")
        .download(profilRes.data.logo_url);
      if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        const ext = profilRes.data.logo_url.split(".").pop()?.toLowerCase();
        const mime =
          ext === "svg"
            ? "image/svg+xml"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "webp"
                ? "image/webp"
                : "image/png";
        logoData = `data:${mime};base64,${buf.toString("base64")}`;
      }
    } catch {
      logoData = null; // Échec silencieux : on rend le PDF sans logo
    }
  }

  // Nettoyage : retire la propriété "client" imbriquée pour passer le strict typage
  const { client: _client, ...factureClean } = factureRaw;

  const stream = await renderToStream(
    FacturePdf({
      facture: factureClean,
      lignes: lignesRes.data ?? [],
      client,
      profil: profilRes.data,
      logoData,
    }),
  );

  // Conversion stream Node → ReadableStream pour la réponse Web
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
      "Content-Disposition": `attachment; filename="${factureClean.numero ?? "facture"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
