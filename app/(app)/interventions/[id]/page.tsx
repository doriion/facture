import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, FileText, Receipt, Repeat } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { getIntervention } from "@/lib/actions/interventions";
import { listInterventionPhotos } from "@/lib/actions/intervention-photos";
import { listInterventionSignatures } from "@/lib/actions/signatures";
import { listCerfaDocuments } from "@/lib/actions/cerfa";
import { listBonsIntervention } from "@/lib/actions/bons-intervention";
import { getProfil } from "@/lib/actions/profil";
import { AjouterTacheButton } from "@/components/taches/ajouter-tache-button";
import { InterventionForm } from "@/components/interventions/intervention-form";
import { InterventionPhotos } from "@/components/interventions/intervention-photos";
import { InterventionSignatures } from "@/components/interventions/intervention-signatures";
import { InterventionCerfa } from "@/components/interventions/intervention-cerfa";
import { InterventionBon } from "@/components/interventions/intervention-bon";
import { InterventionDeleteButton } from "@/components/interventions/intervention-delete-button";
import { InterventionCorbeilleBanner } from "@/components/interventions/intervention-corbeille-banner";
import { HistoriqueClientCard } from "@/components/interventions/historique-client-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/format";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";

export const metadata = { title: "Édition intervention — NG Gestion" };

export default async function EditInterventionPage({
  params,
}: {
  params: { id: string };
}) {
  const { intervention, client, facture } = await getIntervention(params.id);
  if (!intervention) notFound();

  const [clients, photos, signatures, cerfaDocs, profil, bons] = await Promise.all([
    listClients(),
    listInterventionPhotos(params.id),
    listInterventionSignatures(params.id),
    listCerfaDocuments(params.id),
    getProfil(),
    listBonsIntervention(params.id),
  ]);

  const operateurNom =
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") || undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
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
              {client ? (
                <>
                  {" — "}
                  <Link
                    href={`/clients/${client.id}`}
                    className="hover:underline"
                  >
                    {client.nom}
                  </Link>
                </>
              ) : (
                <>
                  {" — "}
                  <Badge
                    variant="outline"
                    className="border-orange-400 font-normal text-orange-700 dark:text-orange-300"
                  >
                    Client à renseigner
                  </Badge>
                </>
              )}
            </p>
            {intervention.serie_id && (
              <div className="mt-2">
                <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
                  <Repeat className="size-3" />
                  Rendez-vous récurrent — la série se modifie depuis l&apos;agenda
                </Badge>
              </div>
            )}
            {!facture && intervention.a_facturer === false && (
              <div className="mt-2">
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  Rien à facturer
                </Badge>
              </div>
            )}
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
          {intervention.supprime_le ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <AjouterTacheButton
              lienLabel={`Intervention du ${formatDateFr(intervention.date_intervention)}`}
              interventionId={intervention.id}
            />
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
            {/* Prochaine visite : même client, même matériel, date à poser. */}
            <Button variant="outline" asChild>
              <Link href={`/interventions/nouvelle?source=${intervention.id}`}>
                <CalendarPlus className="size-4" />
                Planifier la prochaine visite
              </Link>
            </Button>
            <InterventionDeleteButton id={intervention.id} />
          </div>
          )}
        </div>
      </div>

      {intervention.supprime_le && (
        <InterventionCorbeilleBanner id={intervention.id} supprimeLe={intervention.supprime_le} />
      )}

      {/* Sur le téléphone (sur le chantier), photos et signatures
          d'abord : c'est ce qu'on fait sur place. Le formulaire complet
          et la fiche fluides suivent. Sur PC, ordre inchangé. */}
      <div className="flex flex-col gap-6">
        <div className="max-md:order-3">
          <InterventionForm clients={clients} intervention={intervention} />
        </div>

        {client && (
          <div className="max-md:order-3">
            <HistoriqueClientCard
              clientId={client.id}
              clientNom={client.nom}
              interventionId={intervention.id}
            />
          </div>
        )}

        <div className="max-md:order-4">
          <InterventionCerfa
            intervention={intervention}
            documents={cerfaDocs}
            attestationManquante={!profil?.num_attestation_fluides_frigo}
          />
        </div>

        <div className="max-md:order-2">
          <InterventionSignatures
            interventionId={intervention.id}
            operateur={signatures.operateur}
            detenteur={signatures.detenteur}
            operateurNom={operateurNom}
          />
        </div>

        {/* Bon d'intervention : juste après les signatures, c'est la
            dernière étape sur place (remise ou envoi au client). */}
        {!intervention.supprime_le && (
          <div className="max-md:order-2">
            <InterventionBon
              interventionId={intervention.id}
              bons={bons}
              clientEmail={client?.email ?? null}
              clientNom={client?.nom ?? null}
              signatureClientPresente={Boolean(signatures.detenteur)}
            />
          </div>
        )}

        <div className="max-md:order-1">
          <InterventionPhotos interventionId={intervention.id} photos={photos} />
        </div>
      </div>
    </div>
  );
}
