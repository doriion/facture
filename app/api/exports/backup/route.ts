import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { aujourdhuiParis } from "@/lib/dates";
import { construireExportJson } from "@/lib/sauvegarde-core";
import { nomFichierSauvegarde } from "@/lib/sauvegarde-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export complet des données de l'utilisateur au format JSON
 * (sauvegarde personnelle — obligation de conservation des factures
 * 10 ans). STRICTEMENT en lecture seule : uniquement des SELECT,
 * filtrés par la RLS (auth.uid() = user_id) ET par user_id.
 *
 * Même constructeur que la sauvegarde automatique (lecture paginée :
 * aucune table n'est tronquée à 1 000 lignes). Les fichiers du Storage
 * sont dans /api/exports/backup-fichiers.
 *
 * CONFIDENTIALITÉ : export PRIVÉ, réservé au propriétaire du compte.
 * Il contient les coûts d'achat et les fournisseurs — indispensable
 * pour restaurer, à ne jamais transmettre à un client.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  try {
    const { json } = await construireExportJson(supabase, user.id);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomFichierSauvegarde(aujourdhuiParis())}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new NextResponse(`Échec de l'export : ${message}`, { status: 500 });
  }
}
