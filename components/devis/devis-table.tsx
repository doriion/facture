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
    <>
      {/* Mobile (< md) : cartes verticales entièrement tapables */}
      <div className="space-y-2 md:hidden">
        {devis.map((d) => (
          <Link
            key={d.id}
            href={`/devis/${d.id}`}
            className="block rounded-lg border bg-card p-4 transition-colors active:bg-accent/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">
                  {d.numero}
                  {d.facture_id && (
                    <span className="ml-2 text-[10px] font-sans uppercase tracking-wide text-primary">
                      Facturé
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-sm">
                  {d.client?.nom ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              </div>
              <StatutBadgeDevis statut={d.statut_affichage} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                <p>Émis le {formatDateFr(d.date_emission)}</p>
                <p>Valide jusqu&apos;au {formatDateFr(d.date_validite)}</p>
              </div>
              <p className="text-lg font-bold tabular-nums">
                {formatEuros(Number(d.total_ht))}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop (>= md) : tableau complet inchangé */}
      <div className="hidden rounded-lg border bg-card md:block">
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
    </>
  );
}
