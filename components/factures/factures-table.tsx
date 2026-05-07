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
    <div className="rounded-lg border bg-card">
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {factures.map((f) => (
            <TableRow key={f.id}>
              <TableCell>
                <Link
                  href={`/factures/${f.id}`}
                  className="font-mono font-medium hover:underline"
                >
                  {f.numero}
                </Link>
              </TableCell>
              <TableCell className="text-sm">
                {formatDateFr(f.date_emission)}
              </TableCell>
              <TableCell className="text-sm">
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
              <TableCell className="text-right font-medium tabular-nums">
                {formatEuros(Number(f.total_ht))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
