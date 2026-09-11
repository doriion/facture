import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { payloadLignesPdf } from "@/lib/pdf-payload";
import { estErreurMoteurTva, verifierMoteurTva } from "@/lib/tva-garde";
import { DevisPdf } from "@/components/devis/devis-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const [devisRes, lignesRes, profilRes] = await Promise.all([
    supabase
      .from("devis")
      .select("*, client:clients(*)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("devis_lignes")
      .select("*")
      .eq("devis_id", params.id)
      .order("ordre"),
    supabase
      .from("profil_entreprise")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!devisRes.data) {
    return new NextResponse("Devis introuvable", { status: 404 });
  }

  type DevisWithClient = NonNullable<typeof devisRes.data> & {
    client: Parameters<typeof DevisPdf>[0]["client"];
  };
  const raw = devisRes.data as DevisWithClient;
  const client = raw.client ?? null;

  // Garde-fou : pas de rendu d'un document assujetti à la TVA tant que
  // l'app ne sait pas la calculer (snapshot émetteur prioritaire).
  try {
    verifierMoteurTva(profilRes.data, raw.emetteur);
  } catch (e) {
    if (!estErreurMoteurTva(e)) throw e;
    return new NextResponse(e.explication, {
      status: 501,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Logo → data URI
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
      logoData = null;
    }
  }

  const { client: _client, ...devisClean } = raw;

  // Signature client « Bon pour accord » → data URI (bucket privé)
  let signatureData: string | null = null;
  if (devisClean.signature_client_url) {
    try {
      const { data: blob } = await supabase.storage
        .from("signatures")
        .download(devisClean.signature_client_url);
      if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        signatureData = `data:image/png;base64,${buf.toString("base64")}`;
      }
    } catch {
      signatureData = null;
    }
  }

  const stream = await renderToStream(
    DevisPdf({
      devis: devisClean,
      // Liste blanche : exclut les coûts privés (prix d'achat, fournisseur)
      lignes: payloadLignesPdf(lignesRes.data ?? []),
      client,
      profil: profilRes.data,
      logoData,
      signatureData,
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
      "Content-Disposition": `attachment; filename="${devisClean.numero ?? "devis"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
