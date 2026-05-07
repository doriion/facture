import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateFr, formatEuros } from "@/lib/format";
import {
  LABELS_FREQUENCE,
  LABELS_STATUT_CONTRAT,
} from "@/lib/validations/contrat";

type ContratRow = {
  id: string;
  intitule: string | null;
  equipement: string | null;
  date_debut: string;
  date_fin: string | null;
  frequence: string;
  prix_annuel_ht: number | string;
  prochaine_visite: string | null;
  statut: string;
  client: { id: string; nom: string; type: string; ville: string | null } | null;
};

const variantByStatut: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "destructive"
> = {
  actif: "success",
  suspendu: "outline",
  termine: "secondary",
};

export function ContratsTable({ contrats }: { contrats: ContratRow[] }) {
  if (contrats.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        Aucun contrat de maintenance. Cliquez sur « Nouveau contrat » pour
        commencer.
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Intitulé / équipement</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Fréquence</TableHead>
            <TableHead>Prochaine visite</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Prix annuel HT</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contrats.map((c) => {
            const overdue =
              c.statut === "actif" &&
              c.prochaine_visite &&
              c.prochaine_visite < today;
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/maintenance/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.intitule || "Contrat de maintenance"}
                  </Link>
                  {c.equipement && (
                    <p className="text-xs text-muted-foreground">
                      {c.equipement}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {c.client ? (
                    <Link
                      href={`/clients/${c.client.id}`}
                      className="hover:underline"
                    >
                      {c.client.nom}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {LABELS_FREQUENCE[
                    c.frequence as keyof typeof LABELS_FREQUENCE
                  ] ?? c.frequence}
                </TableCell>
                <TableCell className="text-sm">
                  {c.prochaine_visite ? (
                    <span
                      className={
                        overdue ? "font-medium text-destructive" : undefined
                      }
                    >
                      {formatDateFr(c.prochaine_visite)}
                      {overdue && " (en retard)"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={variantByStatut[c.statut] ?? "default"}>
                    {LABELS_STATUT_CONTRAT[
                      c.statut as keyof typeof LABELS_STATUT_CONTRAT
                    ] ?? c.statut}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatEuros(Number(c.prix_annuel_ht))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
