import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatutBadge } from "@/components/factures/statut-badge";
import { MarquerPayeeButton } from "@/components/factures/marquer-payee-button";
import { formatDateFr, formatEuros } from "@/lib/format";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";

type FactureRow = {
  id: string;
  numero: string;
  date_emission: string;
  date_echeance: string;
  total_ht: number | string;
  type_activite: string;
  statut: string;
  statut_affichage: string;
  client: { id: string; nom: string; type: string } | null;
};

export function FacturesTable({ factures }: { factures: FactureRow[] }) {
  if (factures.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        Aucune facture. Cliquez sur « Nouvelle facture » pour commencer.
      </div>
    );
  }

  return (
    <>
      {/* Mobile (< md) : cartes verticales entièrement tapables.
          Le lien « étiré » (absolute inset-0) couvre la carte ; les
          actions secondaires repassent au-dessus avec z-10. */}
      <div className="space-y-2 md:hidden">
        {factures.map((f) => {
          const canMarkPaid =
            f.statut === "envoyee" || f.statut_affichage === "retard";
          return (
            <div
              key={f.id}
              className="relative rounded-lg border bg-card p-4 transition-colors active:bg-accent/50"
            >
              <Link
                href={`/factures/${f.id}`}
                className="absolute inset-0"
                aria-label={`Ouvrir la facture ${f.numero}`}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{f.numero}</p>
                  <p className="mt-0.5 truncate text-sm">
                    {f.client?.nom ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </p>
                </div>
                <StatutBadge statut={f.statut_affichage} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  <p>Émise le {formatDateFr(f.date_emission)}</p>
                  <p>Échéance le {formatDateFr(f.date_echeance)}</p>
                </div>
                <p className="text-lg font-bold tabular-nums">
                  {formatEuros(Number(f.total_ht))}
                </p>
              </div>
              {canMarkPaid && (
                <div className="relative z-10 mt-3 border-t pt-3">
                  <MarquerPayeeButton factureId={f.id} compact />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop (>= md) : tableau complet inchangé */}
      <div className="hidden rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Numéro</TableHead>
            <TableHead>Émission</TableHead>
            <TableHead>Échéance</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Activité</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Total HT</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {factures.map((f) => {
            const canMarkPaid =
              f.statut === "envoyee" || f.statut_affichage === "retard";
            return (
              <TableRow key={f.id}>
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={`/factures/${f.id}`}
                    className="font-mono font-medium hover:underline"
                  >
                    {f.numero}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDateFr(f.date_emission)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDateFr(f.date_echeance)}
                </TableCell>
                <TableCell>
                  {f.client ? (
                    <Link
                      href={`/clients/${f.client.id}`}
                      className="hover:underline"
                    >
                      {f.client.nom}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {LABELS_TYPE_ACTIVITE[
                    f.type_activite as keyof typeof LABELS_TYPE_ACTIVITE
                  ] ?? f.type_activite}
                </TableCell>
                <TableCell>
                  <StatutBadge statut={f.statut_affichage} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">
                  {formatEuros(Number(f.total_ht))}
                </TableCell>
                <TableCell className="text-right">
                  {canMarkPaid && (
                    <MarquerPayeeButton factureId={f.id} compact />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </>
  );
}
