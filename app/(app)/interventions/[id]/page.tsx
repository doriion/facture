import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Receipt } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { getIntervention } from "@/lib/actions/interventions";
import { listInterventionPhotos } from "@/lib/actions/intervention-photos";
import { listInterventionSignatures } from "@/lib/actions/signatures";
import { listCerfaDocuments } from "@/lib/actions/cerfa";
import { getProfil } from "@/lib/actions/profil";
import { InterventionForm } from "@/components/interventions/intervention-form";
import { InterventionPhotos } from "@/components/interventions/intervention-photos";
import { InterventionSignatures } from "@/components/interventions/intervention-signatures";
import { InterventionCerfa } from "@/components/interventions/intervention-cerfa";
import { InterventionDeleteButton } from "@/components/interventions/intervention-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/format";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";

export const metadata = { title: "Édition intervention — Facture AE" };

export default async function EditInterventionPage({
  params,
}: {
  params: { id: string };
}) {
  const { intervention, client, facture } = await getIntervention(params.id);
  if (!intervention) notFound();

  const [clients, photos, signatures, cerfaDocs, profil] = await Promise.all([
    listClients(),
    listInterventionPhotos(params.id),
    listInterventionSignatures(params.id),
    listCerfaDocuments(params.id),
    getProfil(),
  ]);

  const operateurNom =
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") || undefined;

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
            {facture && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="success">Facturée</Badge>
                <Link
                  href={`/factures/${facture.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Voir la facture {facture.numero}
                </Link>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {facture ? (
              <Button variant="outline" asChild>
                <Link href={`/factures/${facture.id}`}>
                  <FileText className="size-4" />
                  Voir la facture
                </Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={`/factures/nouvelle?intervention=${intervention.id}`}>
                  <Receipt className="size-4" />
                  Créer la facture
                </Link>
              </Button>
            )}
            <InterventionDeleteButton id={intervention.id} />
          </div>
        </div>
      </div>

      <InterventionForm clients={clients} intervention={intervention} />

      <InterventionCerfa
        intervention={intervention}
        documents={cerfaDocs}
        attestationManquante={!profil?.num_attestation_fluides_frigo}
      />

      <InterventionSignatures
        interventionId={intervention.id}
        operateur={signatures.operateur}
        detenteur={signatures.detenteur}
        operateurNom={operateurNom}
      />

      <InterventionPhotos interventionId={intervention.id} photos={photos} />
    </div>
  );
}
