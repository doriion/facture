import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { listProduits } from "@/lib/actions/produits";
import { getProfil } from "@/lib/actions/profil";
import { Button } from "@/components/ui/button";
import { DevisForm } from "@/components/devis/devis-form";

export const metadata = { title: "Nouveau devis — Facture AE" };

export default async function NouveauDevisPage() {
  const [clients, produits, profil] = await Promise.all([
    listClients(),
    listProduits({ inclureInactifs: false }),
    getProfil(),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/devis">
            <ArrowLeft className="size-4" />
            Retour aux devis
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Nouveau devis</h1>
        <p className="text-sm text-muted-foreground">
          Le devis sera créé en brouillon. Vous pourrez ensuite le marquer
          envoyé, télécharger le PDF, et le convertir en facture une fois
          accepté.
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <p className="mb-3">
            Vous n'avez pas encore de client. Créez-en un avant de pouvoir
            établir un devis.
          </p>
          <Button asChild>
            <Link href="/clients">Aller aux clients</Link>
          </Button>
        </div>
      ) : (
        <DevisForm
          clients={clients}
          produits={produits}
          defaultConditions={profil?.conditions_paiement_default}
        />
      )}
    </div>
  );
}
