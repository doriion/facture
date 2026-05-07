import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { listProduits } from "@/lib/actions/produits";
import { getFacture } from "@/lib/actions/factures";
import { getProfil } from "@/lib/actions/profil";
import { FactureForm } from "@/components/factures/facture-form";
import { FactureActions } from "@/components/factures/facture-actions";
import { StatutBadge } from "@/components/factures/statut-badge";
import { Button } from "@/components/ui/button";
import { formatDateFr, formatEuros } from "@/lib/format";
import type { StatutFacture } from "@/lib/validations/facture";

export const metadata = { title: "Édition facture — Facture AE" };

export default async function EditFacturePage({
  params,
}: {
  params: { id: string };
}) {
  const { facture, lignes, client } = await getFacture(params.id);
  if (!facture) notFound();

  const [clients, produits, profil] = await Promise.all([
    listClients(),
    listProduits({ inclureInactifs: false }),
    getProfil(),
  ]);

  const isLocked = facture.statut === "annulee";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/factures">
            <ArrowLeft className="size-4" />
            Retour aux factures
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-bold tracking-tight">
                {facture.numero}
              </h1>
              <StatutBadge statut={facture.statut} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Émise le {formatDateFr(facture.date_emission)} —{" "}
              {client?.nom ?? "Client inconnu"} —{" "}
              <span className="font-medium text-foreground">
                {formatEuros(Number(facture.total_ht))}
              </span>
            </p>
          </div>
          <FactureActions
            factureId={facture.id}
            numero={facture.numero}
            statut={facture.statut as StatutFacture}
          />
        </div>
      </div>

      {isLocked ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
          Cette facture a été annulée. Pour la modifier, restaurez-la d'abord
          en brouillon.
        </div>
      ) : (
        <FactureForm
          clients={clients}
          produits={produits}
          facture={facture}
          lignes={lignes}
          defaultConditionsPaiement={profil?.conditions_paiement_default}
        />
      )}
    </div>
  );
}
