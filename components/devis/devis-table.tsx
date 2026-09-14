import Link from "next/link";
import { CopyPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

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
      {/* Mobile (< md) : cartes verticales entièrement tapables. Le lien
          vers la fiche est « étiré » sur toute la carte (pseudo-élément
          after) pour que le bouton « Dupliquer », lui, reste un lien
          distinct — un lien dans un lien n'est pas du HTML valide. */}
      <div className="space-y-2 md:hidden">
        {devis.map((d) => (
          <div
            key={d.id}
            className="relative rounded-lg border bg-card p-4 transition-colors has-[a:active]:bg-accent/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">
                  <Link
                    href={`/devis/${d.id}`}
                    className="after:absolute after:inset-0 after:content-['']"
                  >
                    {d.numero}
                  </Link>
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
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold tabular-nums">
                  {formatEuros(Number(d.total_ht))}
                </p>
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                  className="relative z-10 size-10"
                  title={`Dupliquer ${d.numero}`}
                >
                  <Link href={`/devis/nouveau?source=${d.id}`}>
                    <CopyPlus className="size-4" />
                    <span className="sr-only">Dupliquer {d.numero}</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
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
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-10 text-right">
              <span className="sr-only">Dupliquer</span>
            </TableHead>
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
              {/* Dupliquer : nouveau devis pré-rempli depuis celui-ci
                  (client vide, dates du jour, numéro attribué à
                  l'enregistrement), sans ouvrir la fiche. */}
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  title={`Dupliquer ${d.numero} (nouveau devis pré-rempli)`}
                >
                  <Link href={`/devis/nouveau?source=${d.id}`}>
                    <CopyPlus className="size-4 text-muted-foreground" />
                    <span className="sr-only">Dupliquer {d.numero}</span>
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </>
  );
}
