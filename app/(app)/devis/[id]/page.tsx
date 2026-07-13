import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { listProduits } from "@/lib/actions/produits";
import { getDevis } from "@/lib/actions/devis";
import { getProfil } from "@/lib/actions/profil";
import { statutAffichageDevis } from "@/lib/validations/devis";
import { DevisForm } from "@/components/devis/devis-form";
import { DevisActions } from "@/components/devis/devis-actions";
import { StatutBadgeDevis } from "@/components/devis/statut-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateFr, formatEuros } from "@/lib/format";

export const metadata = { title: "Édition devis — Facture AE" };

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
  const isLocked = !!devis.facture_id;

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
            <p className="mt-1 text-sm text-muted-foreground">
              Émis le {formatDateFr(devis.date_emission)} — valide jusqu'au{" "}
              {formatDateFr(devis.date_validite)} —{" "}
              {client?.nom ?? "Client inconnu"} —{" "}
              <span className="font-medium text-foreground">
                {formatEuros(Number(devis.total_ht))}
              </span>
            </p>
          </div>
          <DevisActions
            devisId={devis.id}
            numero={devis.numero}
            statut={statutAffiche}
            factureId={devis.facture_id}
            clientEmail={client?.email ?? null}
            clientNom={client?.nom ?? "le client"}
            estModele={devis.est_modele}
          />
        </div>
      </div>

      {isLocked ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
          Ce devis a été converti en facture, il n'est plus modifiable.
        </div>
      ) : (
        <DevisForm
          clients={clients}
          produits={produits}
          devis={devis}
          lignes={lignes}
          defaultConditions={profil?.conditions_paiement_default}
        />
      )}
    </div>
  );
}
