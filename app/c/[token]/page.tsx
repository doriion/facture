import { CheckCircle2, Clock, FileWarning } from "lucide-react";

import { getContratParToken } from "@/lib/contrats/public";
import { retractationApplicable } from "@/lib/contrats/logic";
import {
  nomAffichagePrestataire,
  type ClientSnapshot,
} from "@/lib/contrats/rendu";
import { ContratApercu } from "@/components/contrats/contrat-apercu";
import { ContratSignatureForm } from "@/components/contrats/contrat-signature-form";
import { formatDateFr } from "@/lib/format";

export const metadata = { title: "Signature du contrat d'entretien" };
export const dynamic = "force-dynamic";

/**
 * Page PUBLIQUE de signature (aucun compte requis) : le client accède
 * par le lien unique reçu par e-mail, lit le contrat complet, complète
 * ses informations, coche les consentements et signe au doigt.
 * Le token est résolu côté serveur (service role) — la RLS reste
 * fermée à anon.
 */
export default async function SignatureContratPage({
  params,
}: {
  params: { token: string };
}) {
  const { etat, contrat, prestataire } = await getContratParToken(
    params.token,
  );

  const nomPrestataire = nomAffichagePrestataire(prestataire);

  if (etat === "introuvable" || etat === "revoque" || !contrat) {
    return (
      <Coquille>
        <EtatMessage
          icone={<FileWarning className="size-10 text-muted-foreground" />}
          titre="Lien invalide"
          message="Ce lien de signature n'est plus valide ou a été révoqué. Contactez votre artisan pour en recevoir un nouveau."
        />
      </Coquille>
    );
  }

  if (etat === "expire") {
    return (
      <Coquille>
        <EtatMessage
          icone={<Clock className="size-10 text-muted-foreground" />}
          titre="Lien expiré"
          message={`Ce lien de signature a expiré (validité ${30} jours). Contactez ${nomPrestataire} pour en recevoir un nouveau.`}
        />
      </Coquille>
    );
  }

  const clientSnapshot: ClientSnapshot =
    contrat.client_snapshot && typeof contrat.client_snapshot === "object"
      ? (contrat.client_snapshot as ClientSnapshot)
      : {};

  if (etat === "deja-signe") {
    return (
      <Coquille>
        <EtatMessage
          icone={<CheckCircle2 className="size-10 text-green-600" />}
          titre="Contrat signé — merci !"
          message={`Votre contrat d'entretien n° ${contrat.numero ?? ""} a bien été signé${
            contrat.signed_at
              ? ` le ${formatDateFr(contrat.signed_at.slice(0, 10))}`
              : ""
          }. Vous allez recevoir (ou avez reçu) le PDF signé par e-mail${
            clientSnapshot.email ? ` à ${clientSnapshot.email}` : ""
          }. ${nomPrestataire} en a également reçu une copie.`}
        />
        {contrat.pdf_path && (
          <div className="mx-auto mt-4 max-w-md text-center">
            <a
              href={`/api/public/contrats/${encodeURIComponent(params.token)}/pdf`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Télécharger mon contrat signé (PDF)
            </a>
          </div>
        )}
        <div className="mx-auto mt-6 max-w-3xl rounded-lg border bg-card p-4 sm:p-6">
          <ContratApercu
            contrat={contrat}
            prestataire={prestataire}
            clientSnapshot={clientSnapshot}
          />
        </div>
      </Coquille>
    );
  }

  // etat === "utilisable" : lecture + saisie + signature
  return (
    <Coquille>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          <p className="font-medium">
            {nomPrestataire} vous invite à signer votre contrat d'entretien.
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Lisez le contrat ci-dessous, complétez vos informations en bas de
            page, puis signez au doigt. Validité du lien :{" "}
            {contrat.token_expires_at
              ? `jusqu'au ${formatDateFr(contrat.token_expires_at.slice(0, 10))}`
              : "30 jours"}
            .
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <ContratApercu
            contrat={contrat}
            prestataire={prestataire}
            clientSnapshot={clientSnapshot}
          />
        </div>

        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <ContratSignatureForm
            token={params.token}
            qualiteClient={contrat.qualite_client}
            retractationApplicable={retractationApplicable({
              qualiteClient:
                contrat.qualite_client === "professionnel"
                  ? "professionnel"
                  : "particulier",
              modeConclusion:
                contrat.mode_conclusion === "presentiel"
                  ? "presentiel"
                  : contrat.mode_conclusion === "hors_etablissement"
                    ? "hors_etablissement"
                    : "distance",
            })}
            prefill={{
              nom: clientSnapshot.raison_sociale || clientSnapshot.nom,
              adresse: clientSnapshot.adresse,
              telephone: clientSnapshot.telephone,
              email: clientSnapshot.email,
              siret: clientSnapshot.siret,
            }}
          />
        </div>

        <p className="pb-6 text-center text-xs text-muted-foreground">
          Signature électronique enregistrée avec horodatage — document remis
          aux deux parties. TVA non applicable, art. 293 B du CGI.
        </p>
      </div>
    </Coquille>
  );
}

function Coquille({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background px-3 py-6 sm:px-6">
      {children}
    </main>
  );
}

function EtatMessage({
  icone,
  titre,
  message,
}: {
  icone: React.ReactNode;
  titre: string;
  message: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 pt-16 text-center">
      {icone}
      <h1 className="text-lg font-semibold">{titre}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
