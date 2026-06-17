/**
 * Types + helpers PURS pour l'export URSSAF (pas de "use server").
 *
 * Tout ce qui est synchrone (calcul des périodes, formatage CSV…) vit
 * ici. La server action async qui requête la base est dans
 * `lib/actions/export-urssaf.ts`.
 *
 * Séparation imposée par Next.js : un fichier marqué "use server" ne
 * peut exporter QUE des fonctions async.
 */

export type ExportPeriode = {
  label: string;
  /** YYYY-MM-DD inclusif */
  start: string;
  /** YYYY-MM-DD exclusif */
  end: string;
};

export type ExportRow = {
  numero_facture: string;
  date_facture: string;
  client: string;
  type_activite: string;
  total_facture: number;
  date_encaissement: string | null;
  mode_paiement: string | null;
  reference_paiement: string | null;
  montant_encaisse: number;
};

export type ExportSummary = {
  periode: ExportPeriode;
  /** Recettes encaissées sur la période (base URSSAF) */
  total_encaisse: number;
  /** Factures émises sur la période (info, pas base URSSAF) */
  total_facture_emis: number;
  /** Nombre de factures avec au moins un encaissement sur la période */
  nb_factures: number;
  /** Détail ligne par paiement */
  rows: ExportRow[];
};

/**
 * Calcule les périodes (trimestres + année) disponibles pour l'export.
 * On retourne uniquement les périodes utiles : année en cours + 4
 * trimestres en cours + année précédente complète.
 */
export function getExportPeriodes(now: Date = new Date()): ExportPeriode[] {
  const year = now.getFullYear();
  const periodes: ExportPeriode[] = [];

  // Année en cours
  periodes.push({
    label: `Année ${year}`,
    start: `${year}-01-01`,
    end: `${year + 1}-01-01`,
  });

  // 4 trimestres année en cours
  const trimestres = [
    { num: 1, sm: "01", em: "04" },
    { num: 2, sm: "04", em: "07" },
    { num: 3, sm: "07", em: "10" },
    { num: 4, sm: "10", em: "01" },
  ];
  for (const t of trimestres) {
    const startYear = year;
    const endYear = t.num === 4 ? year + 1 : year;
    periodes.push({
      label: `T${t.num} ${year}`,
      start: `${startYear}-${t.sm}-01`,
      end: `${endYear}-${t.em}-01`,
    });
  }

  // Année précédente
  const prev = year - 1;
  periodes.push({
    label: `Année ${prev}`,
    start: `${prev}-01-01`,
    end: `${year}-01-01`,
  });

  // Trimestres année précédente
  for (const t of trimestres) {
    const sy = prev;
    const ey = t.num === 4 ? prev + 1 : prev;
    periodes.push({
      label: `T${t.num} ${prev}`,
      start: `${sy}-${t.sm}-01`,
      end: `${ey}-${t.em}-01`,
    });
  }

  return periodes;
}

/**
 * Génère un CSV (séparateur ; pour Excel FR) à partir d'un ExportSummary.
 * BOM UTF-8 au début pour qu'Excel ouvre en UTF-8 par défaut.
 */
export function buildCsv(summary: ExportSummary): string {
  const header = [
    "N° Facture",
    "Date facture",
    "Client",
    "Activité",
    "Total facture (€)",
    "Date encaissement",
    "Mode",
    "Référence paiement",
    "Montant encaissé (€)",
  ].join(";");

  const lines = summary.rows.map((r) =>
    [
      r.numero_facture,
      r.date_facture,
      escapeCsv(r.client),
      r.type_activite,
      formatNumberFr(r.total_facture),
      r.date_encaissement ?? "",
      r.mode_paiement ?? "",
      escapeCsv(r.reference_paiement ?? ""),
      formatNumberFr(r.montant_encaisse),
    ].join(";"),
  );

  // Footer total
  const totalLine = [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "TOTAL ENCAISSÉ",
    formatNumberFr(summary.total_encaisse),
  ].join(";");

  return "﻿" + [header, ...lines, "", totalLine].join("\r\n") + "\r\n";
}

function escapeCsv(s: string): string {
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatNumberFr(n: number): string {
  return n.toFixed(2).replace(".", ",");
}
