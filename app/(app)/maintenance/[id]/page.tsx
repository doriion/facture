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
import { dateParis } from "@/lib/dates";
import { confirmationValable, heureLisible } from "@/lib/visite-entretien";

export const metadata = { title: "Contrat de maintenance — NG Gestion" };

export default async function EditContratPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const [{ contrat, client }, clients] = await Promise.all([
    getContrat(params.id),
    listClients(),
  ]);
  if (!contrat) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
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
              {contrat.prochaine_visite ? (
                <>
                  {" — Prochaine visite : "}
                  <strong className="text-foreground">
                    {formatDateFr(contrat.prochaine_visite)}
                    {contrat.prochaine_visite_heure
                      ? ` à ${heureLisible(contrat.prochaine_visite_heure)}`
                      : ""}
                  </strong>
                  {confirmationValable(contrat) && contrat.confirmation_envoyee_le
                    ? ` · confirmation envoyée au client le ${formatDateFr(dateParis(contrat.confirmation_envoyee_le))}`
                    : " · non confirmée au client"}
                </>
              ) : contrat.statut === "actif" ? (
                <>
                  {" — "}
                  <strong className="text-orange-700 dark:text-orange-300">
                    Visite à convenir avec le client
                  </strong>
                </>
              ) : null}
            </p>
          </div>
          <ContratActions
            contratId={contrat.id}
            statut={contrat.statut}
            clientNom={client?.nom ?? null}
            clientEmail={client?.email ?? null}
            prochaineVisite={contrat.prochaine_visite}
            prochaineVisiteHeure={contrat.prochaine_visite_heure}
            confirmationEnvoyeePour={contrat.confirmation_envoyee_pour}
          />
        </div>
      </div>

      <ContratForm clients={clients} contrat={contrat} />
    </div>
  );
}
