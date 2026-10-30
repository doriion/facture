import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Plus, Receipt, Repeat } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { detecteursConnus, getFicheGaz } from "@/lib/actions/fiches-gaz";
import { listInterventionPhotos } from "@/lib/actions/intervention-photos";
import { listInterventionSignatures } from "@/lib/actions/signatures";
import { listCerfaDocuments } from "@/lib/actions/cerfa";
import { listBonsIntervention } from "@/lib/actions/bons-intervention";
import { getProfil } from "@/lib/actions/profil";
import { FicheGazForm } from "@/components/fiches-gaz/fiche-gaz-form";
import { FicheGazDocuments } from "@/components/fiches-gaz/fiche-gaz-documents";
import { InterventionPhotos } from "@/components/interventions/intervention-photos";
import { InterventionSignatures } from "@/components/interventions/intervention-signatures";
import { InterventionCorbeilleBanner } from "@/components/interventions/intervention-corbeille-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/format";

export const metadata = { title: "Fiche gaz — NG Gestion" };

export default async function FicheGazPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { intervention, client, factureNumero, lienSignature } = await getFicheGaz(id);
  if (!intervention) notFound();

  const [clients, detecteurs, photos, signatures, cerfas, bons, profil] = await Promise.all([
    listClients(),
    detecteursConnus(),
    listInterventionPhotos(id),
    listInterventionSignatures(id),
    listCerfaDocuments(id),
    listBonsIntervention(id),
    getProfil(),
  ]);
  const operateurNom = [profil?.prenom, profil?.nom].filter(Boolean).join(" ") || undefined;
  const operateurQualite = profil?.num_attestation_fluides_frigo ? `Opérateur — attestation n° ${profil.num_attestation_fluides_frigo}` : "Opérateur";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/fiches-gaz">
            <ArrowLeft className="size-4" />
            Retour aux fiches gaz
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Fiche gaz{intervention.fiche_numero ? ` n° ${intervention.fiche_numero}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Intervention du {formatDateFr(intervention.date_intervention)}
              {client ? (
                <>
                  {" — "}
                  <Link href={`/clients/${client.id}`} className="hover:underline">
                    {client.nom}
                  </Link>
                </>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {signatures.detenteur ? <Badge variant="success">Signée par le client</Badge> : intervention.signature_demandee_le ? <Badge variant="outline" className="border-amber-400 font-normal text-amber-700 dark:text-amber-300">Signature demandée</Badge> : null}
              {factureNumero && <Badge variant="outline" className="font-normal">Facture {factureNumero}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/interventions/${intervention.id}`}>
                <CalendarDays className="size-4" />
                Voir dans les interventions
              </Link>
            </Button>
            {!factureNumero && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/factures/nouvelle?intervention=${intervention.id}`}>
                  <Receipt className="size-4" />
                  Facturer
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {intervention.supprime_le && <InterventionCorbeilleBanner id={intervention.id} supprimeLe={intervention.supprime_le} />}

      <FicheGazForm clients={clients} fiche={intervention} dateParDefaut={intervention.date_intervention} detecteurs={detecteurs} />

      <InterventionPhotos interventionId={intervention.id} photos={photos} />

      <InterventionSignatures
        interventionId={intervention.id}
        operateur={signatures.operateur}
        detenteur={signatures.detenteur}
        operateurNom={operateurNom}
        operateurQualite={operateurQualite}
        signatureMemorisee={Boolean(profil?.signature_url)}
      />

      {!intervention.supprime_le && (
        <FicheGazDocuments
          ficheId={intervention.id}
          clientEmail={client?.email ?? null}
          clientNom={client?.nom ?? null}
          cerfas={cerfas}
          bons={bons}
          detenteurSigne={Boolean(signatures.detenteur)}
          operateurSigne={Boolean(signatures.operateur)}
          reservesRenseignees={intervention.bon_reserves === "sans" || intervention.bon_reserves === "avec"}
          lienSignature={lienSignature}
          signatureDemandeeLe={intervention.signature_demandee_le}
        />
      )}

      {client && (
        <div className="rounded-lg border border-dashed p-4 text-sm">
          <p className="font-medium">Et ensuite chez {client.nom} ?</p>
          <p className="text-muted-foreground">Chaque équipement a sa fiche et son CERFA ; la visite suivante repart du même matériel.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/fiches-gaz/nouvelle?client=${client.id}&date=${intervention.date_intervention}`}>
                <Plus className="size-4" />
                Ajouter un équipement (une fiche de plus)
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/fiches-gaz/nouvelle?source=${intervention.id}`}>
                <Repeat className="size-4" />
                Nouvelle visite sur cet équipement
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
