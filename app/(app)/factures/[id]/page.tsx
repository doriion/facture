import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { listProduits } from "@/lib/actions/produits";
import { getFacture, listFactureEnfants } from "@/lib/actions/factures";
import { getProfil } from "@/lib/actions/profil";
import { getFacturePaiements } from "@/lib/actions/paiements";
import { FactureForm } from "@/components/factures/facture-form";
import { FacturePaiements } from "@/components/factures/facture-paiements";
import { FactureAcompteSolde } from "@/components/factures/facture-acompte-solde";
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

  const [clients, produits, profil, paiementsSummary, enfants] = await Promise.all([
    listClients(),
    listProduits({ inclureInactifs: false }),
    getProfil(),
    getFacturePaiements(params.id),
    listFactureEnfants(params.id),
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
            clientEmail={client?.email ?? null}
            clientNom={client?.nom ?? "le client"}
          />
        </div>
      </div>

      {/* Bandeau si acompte ou solde */}
      {(facture as { type_facture?: string }).type_facture === "acompte" && (
        <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            📋 Facture d'acompte
            {(facture as { pourcentage_acompte?: number | null })
              .pourcentage_acompte
              ? ` (${(facture as { pourcentage_acompte?: number | null }).pourcentage_acompte}%)`
              : ""}
          </p>
        </div>
      )}
      {(facture as { type_facture?: string }).type_facture === "solde" && (
        <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">
            ✅ Facture de solde — déduction faite des acomptes
          </p>
        </div>
      )}

      {isLocked ? (
        <div className="rounded-lg border-l-4 border-rose-500 bg-rose-50 p-4 text-sm dark:bg-rose-950/30">
          <p className="font-medium text-rose-900 dark:text-rose-100">
            ⊘ Facture annulée
            {facture.date_annulation && (
              <> le {formatDateFr(facture.date_annulation)}</>
            )}
          </p>
          {facture.motif_annulation && (
            <p className="mt-1 text-rose-800 dark:text-rose-200">
              <strong>Motif :</strong> {facture.motif_annulation}
            </p>
          )}
          <p className="mt-2 text-xs text-rose-700/80 dark:text-rose-300/80">
            Le numéro <strong>{facture.numero}</strong> reste réservé en base
            pour la traçabilité fiscale. Pour modifier le contenu, restaurez
            d'abord en brouillon.
          </p>
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

      {!isLocked && facture.statut !== "brouillon" && (
        <FacturePaiements
          factureId={facture.id}
          summary={paiementsSummary}
        />
      )}

      {/* Acompte/solde uniquement sur les factures normales (pas
          acomptes ni soldes eux-mêmes) et avec au moins une ligne. */}
      {!isLocked &&
        (facture as { type_facture?: string }).type_facture === "normale" &&
        Number(facture.total_ht) > 0 && (
          <FactureAcompteSolde
            factureId={facture.id}
            totalParent={Number(facture.total_ht)}
            enfants={enfants}
          />
        )}
    </div>
  );
}
