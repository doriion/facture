import { NextResponse, type NextRequest } from "next/server";
import { renderToStream } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { payloadLignesPdf } from "@/lib/pdf-payload";
import { estErreurMoteurTva, verifierMoteurTva } from "@/lib/tva-garde";
import { FacturePdf } from "@/components/factures/facture-pdf";
import { logoApplication } from "@/lib/logo-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Génère et streame le PDF d'une facture.
 * Le middleware (middleware.ts) renvoie déjà 401 sur /api si non
 * authentifié ; on regarde ici aussi en double sécurité, et on vérifie
 * la propriété (la RLS Supabase la garantit, mais on remonte un 404
 * propre si la facture n'est pas accessible à l'utilisateur).
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
  const devisSource = factureRaw.devis_id
    ? (
        await supabase
          .from("devis")
          .select("numero, date_emission")
          .eq("id", factureRaw.devis_id)
          .maybeSingle()
      ).data
    : null;
  // Avoir : la facture corrigée est une mention obligatoire du document.
  const factureParent =
    factureRaw.type_facture === "avoir" && factureRaw.facture_parent_id
      ? (
          await supabase
            .from("factures")
            .select("numero, date_emission")
            .eq("id", factureRaw.facture_parent_id)
            .maybeSingle()
        ).data
      : null;

  // Garde-fou : pas de rendu d'un document assujetti à la TVA tant que
  // l'app ne sait pas la calculer (snapshot émetteur prioritaire).
  try {
    verifierMoteurTva(profilRes.data, factureRaw.emetteur);
  } catch (e) {
    if (!estErreurMoteurTva(e)) throw e;
    return new NextResponse(e.explication, {
      status: 501,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

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
  // À défaut de logo dans Paramètres, celui de l'application : un
  // document sans aucune marque fait moins sérieux qu'un document
  // portant le logo générique.
  logoData = logoData ?? (await logoApplication());

  // Nettoyage : retire la propriété "client" imbriquée pour passer le strict typage
  const { client: _client, ...factureClean } = factureRaw;

  const stream = await renderToStream(
    FacturePdf({
      facture: factureClean,
      // Liste blanche : exclut les coûts privés (prix d'achat, fournisseur)
      lignes: payloadLignesPdf(lignesRes.data ?? []),
      client,
      profil: profilRes.data,
      logoData,
      devisSource,
      factureParent,
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
