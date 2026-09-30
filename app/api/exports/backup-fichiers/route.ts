import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { aujourdhuiParis } from "@/lib/dates";
import { construireArchiveFichiers } from "@/lib/sauvegarde-core";
import { nomArchiveFichiers } from "@/lib/sauvegarde-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Téléchargement de tous les fichiers du Storage : plus long qu'un JSON.
export const maxDuration = 60;

/**
 * Archive ZIP des fichiers du Storage de l'utilisateur (PDF de contrats
 * signés, signatures, CERFA, bons d'intervention, logo, photos), avec
 * un index.json. Complément de /api/exports/backup : les chemins
 * stockés en base (storage_path, pdf_path…) se retrouvent tels quels
 * sous fichiers/<bucket>/. Lecture seule, filtrée par la RLS des
 * buckets (dossier {user_id}/) ET par user_id.
 */
export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  try {
    const dateIso = aujourdhuiParis();
    const { zip } = await construireArchiveFichiers(supabase, user.id, dateIso);
    return new NextResponse(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nomArchiveFichiers(dateIso)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new NextResponse(`Échec de l'archive : ${message}`, { status: 500 });
  }
}
