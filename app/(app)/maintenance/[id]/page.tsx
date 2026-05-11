import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { getContrat } from "@/lib/actions/contrats";
import { ContratForm } from "@/components/maintenance/contrat-form";
import { ContratActions } from "@/components/maintenance/contrat-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LABELS_STATUT_CONTRAT } from "@/lib/validations/contrat";
import { formatDateFr } from "@/lib/format";

export const metadata = { title: "Contrat de maintenance — Facture AE" };

export default async function EditContratPage({
  params,
}: {
  params: { id: string };
}) {
  const { contrat, client } = await getContrat(params.id);
  if (!contrat) notFound();

  const clients = await listClients();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/maintenance">
            <ArrowLeft className="size-4" />
            Retour aux contrats
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {contrat.intitule || "Contrat de maintenance"}
              </h1>
              <Badge variant="secondary">
                {LABELS_STATUT_CONTRAT[
                  contrat.statut as keyof typeof LABELS_STATUT_CONTRAT
                ] ?? contrat.statut}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {client && (
                <Link
                  href={`/clients/${client.id}`}
                  className="hover:underline"
                >
                  {client.nom}
                </Link>
              )}
              {contrat.prochaine_visite && (
                <>
                  {" — Prochaine visite : "}
                  <strong className="text-foreground">
                    {formatDateFr(contrat.prochaine_visite)}
                  </strong>
                </>
              )}
            </p>
          </div>
          <ContratActions contratId={contrat.id} statut={contrat.statut} />
        </div>
      </div>

      <ContratForm clients={clients} contrat={contrat} />
    </div>
  );
}
