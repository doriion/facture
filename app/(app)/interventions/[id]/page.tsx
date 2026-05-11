import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { getIntervention } from "@/lib/actions/interventions";
import { InterventionForm } from "@/components/interventions/intervention-form";
import { InterventionDeleteButton } from "@/components/interventions/intervention-delete-button";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/format";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";

export const metadata = { title: "Édition intervention — Facture AE" };

export default async function EditInterventionPage({
  params,
}: {
  params: { id: string };
}) {
  const { intervention, client } = await getIntervention(params.id);
  if (!intervention) notFound();

  const clients = await listClients();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/interventions">
            <ArrowLeft className="size-4" />
            Retour aux interventions
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Intervention{" "}
              {intervention.date_fin &&
              intervention.date_fin !== intervention.date_intervention
                ? `du ${formatDateFr(intervention.date_intervention)} au ${formatDateFr(intervention.date_fin)}`
                : `du ${formatDateFr(intervention.date_intervention)}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {LABELS_TYPE_INTERVENTION[
                intervention.type as keyof typeof LABELS_TYPE_INTERVENTION
              ] ?? intervention.type}
              {client && (
                <>
                  {" — "}
                  <Link
                    href={`/clients/${client.id}`}
                    className="hover:underline"
                  >
                    {client.nom}
                  </Link>
                </>
              )}
            </p>
          </div>
          <InterventionDeleteButton id={intervention.id} />
        </div>
      </div>

      <InterventionForm clients={clients} intervention={intervention} />
    </div>
  );
}
