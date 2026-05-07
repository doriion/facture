import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
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

  const stream = await renderToStream(
    DevisPdf({
      devis: devisClean,
      lignes: lignesRes.data ?? [],
      client,
      profil: profilRes.data,
      logoData,
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
      "Content-Disposition": `inline; filename="${devisClean.numero ?? "devis"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
