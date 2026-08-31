import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export complet des données de l'utilisateur au format JSON
 * (sauvegarde personnelle — obligation de conservation des factures
 * 10 ans). STRICTEMENT en lecture seule : uniquement des SELECT,
 * filtrés par la RLS (auth.uid() = user_id).
 *
 * Le fichier ne contient PAS les binaires du Storage (logo, photos
 * d'intervention) — seulement leurs chemins. Les mentions et montants
 * de chaque facture/devis sont intégralement présents.
 */

/**
 * Tables utilisateur exportées, dans un ordre lisible.
 * INVARIANT : cette liste doit couvrir TOUTES les tables métier du
 * schéma public (vérifié le 28/08/2026 : 18/18, `select *` embarque
 * aussi les colonnes récentes comme `emetteur` et `nature_fiscale`).
 * Toute migration qui crée une table doit l'ajouter ici.
 */
const TABLES = [
  "profil_entreprise",
  "clients",
  "produits_services",
  "factures",
  "factures_lignes",
  "devis",
  "devis_lignes",
  "paiements",
  "relances",
  "declarations_urssaf",
  "taux_cotisations",
  "interventions",
  "intervention_photos",
  "intervention_signatures",
  "intervention_cerfa",
  "contrats_maintenance",
  "facture_external_events",
  "numerotation",
] as const;

export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Non authentifié", { status: 401 });
  }

  const results = await Promise.all(
    TABLES.map((table) => supabase.from(table).select("*")),
  );

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (let i = 0; i < TABLES.length; i++) {
    const table = TABLES[i]!;
    const res = results[i]!;
    if (res.error) {
      return new NextResponse(
        `Échec de l'export (table ${table}) : ${res.error.message}`,
        { status: 500 },
      );
    }
    data[table] = res.data ?? [];
    counts[table] = data[table].length;
  }

  const exportedAt = new Date();
  const dateStr = exportedAt.toISOString().slice(0, 10);

  const payload = {
    meta: {
      app: "facture-ae",
      format_version: 1,
      exported_at: exportedAt.toISOString(),
      user_id: user.id,
      tables: counts,
      note: "Sauvegarde JSON complète (obligation de conservation des pièces : 10 ans — conservez ce fichier hors de l'application). Les fichiers du Storage (logo, photos, signatures, CERFA PDF) ne sont pas inclus, seulement leurs chemins : téléchargez aussi les PDF archivés depuis les fiches.",
    },
    data,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sauvegarde-facture-ae-${dateStr}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
