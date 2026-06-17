import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { buildExportUrssaf } from "@/lib/actions/export-urssaf";
import { buildCsv } from "@/lib/exports/urssaf-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Génère et streame un CSV des recettes encaissées pour la période.
 * Query params : ?start=YYYY-MM-DD&end=YYYY-MM-DD&label=Texte
 *
 * Base micro-entrepreneur = paiements encaissés sur la période
 * (pas factures émises). C'est ce que demande l'URSSAF.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  const label = req.nextUrl.searchParams.get("label") ?? "periode";

  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return new Response("Paramètres start/end invalides (YYYY-MM-DD).", {
      status: 400,
    });
  }

  const summary = await buildExportUrssaf(start, end);
  const csv = buildCsv(summary);

  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `urssaf-${safeLabel}-${start}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
