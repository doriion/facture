import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { getIntervention } from "@/lib/actions/interventions";
import { listInterventionPhotos } from "@/lib/actions/intervention-photos";
import { listInterventionSignatures } from "@/lib/actions/signatures";
import { getProfil } from "@/lib/actions/profil";
import { InterventionPhotos } from "@/components/interventions/intervention-photos";
import { InterventionSignatures } from "@/components/interventions/intervention-signatures";
import { ClotureIssue } from "@/components/cloture/cloture-issue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/format";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";

export const metadata = { title: "Clôturer l'intervention — NG Gestion" };

/**
 * Fin d'intervention en UN écran, depuis l'agenda : photos, signature
 * du client, puis l'issue — facturer maintenant (propositions en un
 * tap, envoi par e-mail), rien à facturer, ou facturé par le donneur
 * d'ordre. L'intervention sort de la liste « à facturer » dans la foulée.
 */
export default async function CloturePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { intervention, client, facture } = await getIntervention(id);
  if (!intervention) notFound();
  const [photos, signatures, profil] = await Promise.all([listInterventionPhotos(id), listInterventionSignatures(id), getProfil()]);
  const operateurNom = [profil?.prenom, profil?.nom].filter(Boolean).join(" ") || undefined;
  const typeLabel = LABELS_TYPE_INTERVENTION[intervention.type as keyof typeof LABELS_TYPE_INTERVENTION] ?? intervention.type;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/agenda">
            <ArrowLeft className="size-4" />
            Retour à l&apos;agenda
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Terminer l&apos;intervention</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {typeLabel} du {formatDateFr(intervention.date_intervention)}
          {client ? ` — ${client.nom}` : ""}
          {intervention.description ? ` · ${intervention.description.split(/\r?\n/)[0]}` : ""}
        </p>
        {!client && (
          <Badge variant="outline" className="mt-2 border-orange-400 font-normal text-orange-700 dark:text-orange-300">
            Client à renseigner avant de facturer
          </Badge>
        )}
        {facture && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-primary" />
            Déjà facturée :{" "}
            <Link href={`/factures/${facture.id}`} className="font-medium text-primary hover:underline">
              {facture.numero}
            </Link>
          </div>
        )}
      </div>

      <InterventionPhotos interventionId={intervention.id} photos={photos} />

      <InterventionSignatures
        interventionId={intervention.id}
        operateur={signatures.operateur}
        detenteur={signatures.detenteur}
        operateurNom={operateurNom}
        operateurQualite={profil?.num_attestation_fluides_frigo ? `Opérateur — attestation n° ${profil.num_attestation_fluides_frigo}` : "Opérateur"}
        signatureMemorisee={Boolean(profil?.signature_url)}
      />

      <ClotureIssue
        interventionId={intervention.id}
        clientId={client?.id ?? null}
        clientNom={client?.nom ?? null}
        dejaFacturee={Boolean(facture)}
        aFacturer={intervention.a_facturer}
      />
    </div>
  );
}
