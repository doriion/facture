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
import { formatDateFr } from "@/lib/format";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";

type InterventionRow = {
  id: string;
  date_intervention: string;
  type: string;
  description: string | null;
  equipement_marque: string | null;
  equipement_modele: string | null;
  equipement_num_serie: string | null;
  fluide_frigo_type: string | null;
  fluide_frigo_kg_ajoute: number | null;
  fluide_frigo_kg_recupere: number | null;
  client: { id: string; nom: string; type: string } | null;
};

const variantByType: Record<
  string,
  "default" | "secondary" | "outline" | "warning"
> = {
  installation: "default",
  depannage: "warning",
  entretien: "secondary",
  autre: "outline",
};

export function InterventionsTable({
  interventions,
}: {
  interventions: InterventionRow[];
}) {
  if (interventions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        Aucune intervention. Cliquez sur « Nouvelle intervention » pour
        commencer.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Équipement</TableHead>
            <TableHead className="text-right">Fluide (kg ajoutés/récup.)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {interventions.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <Link
                  href={`/interventions/${i.id}`}
                  className="font-medium hover:underline"
                >
                  {formatDateFr(i.date_intervention)}
                </Link>
                {i.description && (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {i.description}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={variantByType[i.type] ?? "default"}>
                  {LABELS_TYPE_INTERVENTION[
                    i.type as keyof typeof LABELS_TYPE_INTERVENTION
                  ] ?? i.type}
                </Badge>
              </TableCell>
              <TableCell>
                {i.client ? (
                  <Link
                    href={`/clients/${i.client.id}`}
                    className="hover:underline"
                  >
                    {i.client.nom}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {i.equipement_marque && (
                  <p>
                    {i.equipement_marque} {i.equipement_modele}
                  </p>
                )}
                {i.equipement_num_serie && (
                  <p className="text-xs font-mono text-muted-foreground">
                    {i.equipement_num_serie}
                  </p>
                )}
                {!i.equipement_marque && !i.equipement_num_serie && (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {i.fluide_frigo_type ? (
                  <>
                    <span className="font-mono">{i.fluide_frigo_type}</span>{" "}
                    <span className="text-muted-foreground">
                      +{Number(i.fluide_frigo_kg_ajoute ?? 0).toFixed(2)} /
                      −{Number(i.fluide_frigo_kg_recupere ?? 0).toFixed(2)} kg
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
