import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatutBadgeDevis } from "@/components/devis/statut-badge";
import { formatDateFr, formatEuros } from "@/lib/format";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";

type DevisRow = {
  id: string;
  numero: string;
  date_emission: string;
  date_validite: string;
  total_ht: number | string;
  type_activite: string;
  statut: string;
  statut_affichage: string;
  facture_id: string | null;
  client: { id: string; nom: string; type: string } | null;
};

export function DevisTable({ devis }: { devis: DevisRow[] }) {
  if (devis.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        Aucun devis. Cliquez sur « Nouveau devis » pour commencer.
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
            <TableHead>Validité</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Activité</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Total HT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devis.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <Link
                  href={`/devis/${d.id}`}
                  className="font-mono font-medium hover:underline"
                >
                  {d.numero}
                </Link>
                {d.facture_id && (
                  <p className="text-[10px] uppercase tracking-wide text-primary">
                    Facturé
                  </p>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {formatDateFr(d.date_emission)}
              </TableCell>
              <TableCell className="text-sm">
                {formatDateFr(d.date_validite)}
              </TableCell>
              <TableCell>
                {d.client ? (
                  <Link
                    href={`/clients/${d.client.id}`}
                    className="hover:underline"
                  >
                    {d.client.nom}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {LABELS_TYPE_ACTIVITE[
                  d.type_activite as keyof typeof LABELS_TYPE_ACTIVITE
                ] ?? d.type_activite}
              </TableCell>
              <TableCell>
                <StatutBadgeDevis statut={d.statut_affichage} />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatEuros(Number(d.total_ht))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
