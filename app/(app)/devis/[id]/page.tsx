import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { listProduits } from "@/lib/actions/produits";
import { getDevis } from "@/lib/actions/devis";
import { getProfil } from "@/lib/actions/profil";
import { statutAffichageDevis } from "@/lib/validations/devis";
import { motifVerrouDevis } from "@/lib/devis-transitions";
import { modeleSansNom, nomModeleAffiche } from "@/lib/modeles-devis";
import {
  assujettiTvaEffectif,
  documentEmis,
  explicationMoteurTva,
} from "@/lib/tva-garde";
import { AjouterTacheButton } from "@/components/taches/ajouter-tache-button";
import { DevisForm } from "@/components/devis/devis-form";
import { DevisActions } from "@/components/devis/devis-actions";
import { DevisSignatureDialog } from "@/components/devis/devis-signature-dialog";
import { StatutBadgeDevis } from "@/components/devis/statut-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateFr, formatEuros } from "@/lib/format";

export const metadata = { title: "Édition devis — NG Gestion" };

export default async function EditDevisPage({
  params,
}: {
  params: { id: string };
}) {
  const { devis, lignes, client } = await getDevis(params.id);
  if (!devis) notFound();

  const [clients, produits, profil] = await Promise.all([
    listClients(),
    listProduits({ inclureInactifs: false }),
    getProfil(),
  ]);

  const statutAffiche = statutAffichageDevis(devis.statut, devis.date_validite);
  // Devis converti OU signé : contenu figé (la signature du client
  // porte sur ce contenu précis, le modifier après coup la viderait de
  // son sens). Le motif exact vient de la machine à états.
  const signee = !!devis.signature_client_url;
  const motifVerrou = motifVerrouDevis({
    signee,
    convertie: !!devis.facture_id,
  });
  const isLocked = motifVerrou !== null;

  // Garde TVA : la route PDF répond 501, mais un `<a download>` avale le
  // corps de la réponse — on explique donc côté page.
  const assujettiTva = assujettiTvaEffectif(profil, devis.emetteur);
  const pdfBloqueMotif = assujettiTva
    ? explicationMoteurTva(documentEmis(devis.emetteur))
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/devis">
            <ArrowLeft className="size-4" />
            Retour aux devis
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-bold tracking-tight">
                {devis.numero}
              </h1>
              {devis.est_modele ? (
                <Badge variant="secondary">Modèle</Badge>
              ) : (
                <StatutBadgeDevis statut={statutAffiche} />
              )}
            </div>
            {devis.est_modele && (
              <p className="mt-1 text-base font-medium">
                {nomModeleAffiche(devis)}
                {modeleSansNom(devis) && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    — donnez-lui un nom pour le retrouver plus vite
                  </span>
                )}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              Émis le {formatDateFr(devis.date_emission)} — valide jusqu'au{" "}
              {formatDateFr(devis.date_validite)} —{" "}
              {client?.nom ?? "Client inconnu"} —{" "}
              <span className="font-medium text-foreground">
                {formatEuros(Number(devis.total_ht))}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!devis.est_modele && (
              <AjouterTacheButton
                lienLabel={`Devis ${devis.numero}`}
                titre={`Relancer le devis ${devis.numero}`}
                devisId={devis.id}
              />
            )}
            {!devis.est_modele && (
              <DevisSignatureDialog
                devisId={devis.id}
                numero={devis.numero}
                signatureUrl={devis.signature_client_url}
                dateSignature={devis.date_signature}
                statut={statutAffiche}
              />
            )}
            <DevisActions
              devisId={devis.id}
              numero={devis.numero}
              statut={statutAffiche}
              factureId={devis.facture_id}
              clientEmail={client?.email ?? null}
              clientNom={client?.nom ?? "le client"}
              estModele={devis.est_modele}
              nomModele={devis.nom_modele}
              signee={signee}
              pdfBloqueMotif={pdfBloqueMotif}
            />
          </div>
        </div>
      </div>

      {isLocked ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
          {motifVerrou}
          {signee && !devis.facture_id && (
            <span className="mt-2 block">
              Pour modifier les prestations, dupliquez ce devis : la copie
              repart en brouillon, signature comprise à refaire.
            </span>
          )}
        </div>
      ) : (
        <DevisForm
          clients={clients}
          produits={produits}
          devis={devis}
          lignes={lignes}
          defaultConditions={profil?.conditions_paiement_default}
          dureeValiditeJours={profil?.duree_validite_devis_jours}
          assujettiTva={assujettiTva}
        />
      )}
    </div>
  );
}
