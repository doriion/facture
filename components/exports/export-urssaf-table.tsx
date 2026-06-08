"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

import {
  type ExportPeriode,
  type ExportSummary,
} from "@/lib/actions/export-urssaf";
import { formatDateFr, formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ExportUrssafTable({
  periodes,
  selected,
  summary,
}: {
  periodes: ExportPeriode[];
  selected: ExportPeriode;
  summary: ExportSummary;
}) {
  const router = useRouter();
  const selectedKey = `${selected.start}|${selected.end}|${selected.label}`;

  const onChangePeriode = (key: string) => {
    const [start, end, label] = key.split("|");
    if (start && end) {
      const params = new URLSearchParams({
        start,
        end,
        label: label ?? "",
      });
      router.push(`/exports?${params.toString()}`);
    }
  };

  const downloadUrl = `/api/exports/urssaf?start=${encodeURIComponent(selected.start)}&end=${encodeURIComponent(selected.end)}&label=${encodeURIComponent(selected.label || "periode")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Période
          </label>
          <Select value={selectedKey} onValueChange={onChangePeriode}>
            <SelectTrigger className="w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodes.map((p) => (
                <SelectItem key={p.label} value={`${p.start}|${p.end}|${p.label}`}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <a href={downloadUrl} download>
            <Download className="size-4" />
            Télécharger CSV (Excel)
          </a>
        </Button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryBox
          label="Recettes encaissées"
          value={formatEuros(summary.total_encaisse)}
          highlight
          hint="À déclarer à l'URSSAF"
        />
        <SummaryBox
          label="Factures émises (info)"
          value={formatEuros(summary.total_facture_emis)}
          hint="Hors annulées"
        />
        <SummaryBox
          label="Factures encaissées"
          value={String(summary.nb_factures)}
          hint="Nombre"
        />
      </div>

      {summary.rows.length === 0 ? (
        <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
          Aucun encaissement sur cette période.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">N° facture</th>
                <th className="px-3 py-2 text-left">Client</th>
                <th className="px-3 py-2 text-left whitespace-nowrap">
                  Encaissement
                </th>
                <th className="px-3 py-2 text-left">Mode</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono">{r.numero_facture}</td>
                  <td className="px-3 py-2">{r.client}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.date_encaissement
                      ? formatDateFr(r.date_encaissement)
                      : "—"}
                    {r.reference_paiement && (
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                        ({r.reference_paiement})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs uppercase text-muted-foreground">
                    {r.mode_paiement ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatEuros(r.montant_encaisse)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/30 font-semibold">
              <tr>
                <td colSpan={4} className="px-3 py-2 text-right text-xs uppercase">
                  Total encaissé
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatEuros(summary.total_encaisse)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Le CSV est compatible Excel/LibreOffice (séparateur point-virgule,
        encodage UTF-8). À utiliser comme base pour votre déclaration
        trimestrielle ou pour le transmettre à un comptable.
      </p>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-md border-2 border-primary bg-primary/5 p-3"
          : "rounded-md border p-3"
      }
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
