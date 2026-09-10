import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { margeLigne, totauxMarges } from "@/lib/marges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export CSV INTERNE des marges — usage privé uniquement (session
 * requise, jamais destiné à un client) : une ligne par ligne de
 * facture de l'année, avec prix d'achat TTC, fournisseur, marge € et %.
 * Les factures annulées et les titres de section sont exclus.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const anneeParam = req.nextUrl.searchParams.get("annee");
  const annee =
    anneeParam && /^\d{4}$/.test(anneeParam)
      ? Number(anneeParam)
      : new Date().getFullYear();

  const { data } = await supabase
    .from("factures_lignes")
    .select(
      "designation, quantite, prix_unitaire_ht, prix_achat_ttc_unitaire, fournisseur, total_ht, type, facture:factures(numero, date_emission, statut, client:clients(nom))",
    )
    .gte("facture.date_emission", `${annee}-01-01`)
    .lte("facture.date_emission", `${annee}-12-31`);

  type LigneJointe = {
    designation: string;
    quantite: number;
    prix_unitaire_ht: number;
    prix_achat_ttc_unitaire: number | null;
    fournisseur: string | null;
    total_ht: number;
    type: string;
    facture: {
      numero: string;
      date_emission: string;
      statut: string;
      client: { nom: string } | null;
    } | null;
  };

  const lignes = ((data ?? []) as unknown as LigneJointe[])
    .filter(
      (l) =>
        l.facture !== null &&
        l.facture.statut !== "annulee" &&
        l.type !== "titre",
    )
    .sort((a, b) =>
      (a.facture!.numero + a.designation).localeCompare(
        b.facture!.numero + b.designation,
      ),
    );

  const fmt = (n: number | null) =>
    n === null ? "" : n.toFixed(2).replace(".", ",");

  const header = [
    "N° Facture",
    "Date",
    "Client",
    "Désignation",
    "Qté",
    "P.U. vente (€)",
    "PA TTC unitaire (€)",
    "Fournisseur",
    "Vente ligne (€)",
    "Coût ligne (€)",
    "Marge (€)",
    "Marge (%)",
  ].join(";");

  const rows = lignes.map((l) => {
    const m = margeLigne(l);
    return [
      l.facture!.numero,
      l.facture!.date_emission,
      escapeCsv(l.facture!.client?.nom ?? ""),
      escapeCsv(l.designation),
      fmt(Number(l.quantite)),
      fmt(Number(l.prix_unitaire_ht)),
      fmt(l.prix_achat_ttc_unitaire === null ? null : Number(l.prix_achat_ttc_unitaire)),
      escapeCsv(l.fournisseur ?? ""),
      fmt(Number(l.total_ht)),
      fmt(m.coutTotal),
      fmt(m.margeEuros),
      m.margePct === null ? "" : fmt(m.margePct),
    ].join(";");
  });

  const totaux = totauxMarges(lignes);
  const footer = [
    "",
    "",
    "",
    `TOTAUX ${annee} (lignes avec PA : ${lignes.length - totaux.nbLignesSansPa}/${lignes.length})`,
    "",
    "",
    "",
    "",
    fmt(totaux.venteCouverte),
    fmt(totaux.coutTotal),
    fmt(totaux.margeTotale),
    totaux.tauxMargePct === null ? "" : fmt(totaux.tauxMargePct),
  ].join(";");

  const csv =
    "﻿" + [header, ...rows, "", footer].join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marges-${annee}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function escapeCsv(s: string): string {
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
