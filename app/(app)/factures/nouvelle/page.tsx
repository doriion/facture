import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { listProduits } from "@/lib/actions/produits";
import { getProfil } from "@/lib/actions/profil";
import { Button } from "@/components/ui/button";
import { FactureForm } from "@/components/factures/facture-form";

export const metadata = { title: "Nouvelle facture — Facture AE" };

export default async function NouvelleFacturePage() {
  const [clients, produits, profil] = await Promise.all([
    listClients(),
    listProduits({ inclureInactifs: false }),
    getProfil(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/factures">
            <ArrowLeft className="size-4" />
            Retour aux factures
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Nouvelle facture</h1>
        <p className="text-sm text-muted-foreground">
          La facture sera créée en brouillon. Vous pourrez ensuite la marquer
          envoyée et générer le PDF.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <p className="mb-3">
            Vous n'avez pas encore de client. Créez-en un avant de pouvoir
            facturer.
          </p>
          <Button asChild>
            <Link href="/clients">Aller aux clients</Link>
          </Button>
        </div>
      ) : (
        <FactureForm
          clients={clients}
          produits={produits}
          defaultConditionsPaiement={profil?.conditions_paiement_default}
        />
      )}
    </div>
  );
}
