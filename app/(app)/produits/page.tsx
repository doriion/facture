import { Plus } from "lucide-react";

import { listProduits } from "@/lib/actions/produits";
import { ProduitFormDialog } from "@/components/produits/produit-form-dialog";
import { ProduitsListe } from "@/components/produits/produits-liste";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Catalogue — NG Gestion" };

/**
 * Catalogue de prestations réutilisables (plomberie, clim, PAC, entretien, dépannage).
 * Tout est chargé une fois ; recherche et catégorie filtrent sur place.
 */
export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: { search?: string; categorie?: string };
}) {
  // En Phase 2 on n'expose pas le filtre actif/inactif ; on inclut tout.
  const produits = await listProduits({ inclureInactifs: true });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Prestations et tarifs réutilisables sur vos factures et devis.
          </p>
        </div>
        <div className="max-md:hidden">
          <ProduitFormDialog />
        </div>
      </div>

      <ProduitsListe
        produits={produits}
        initial={{ search: searchParams.search ?? "", categorie: searchParams.categorie ?? "" }}
      />

      <MobileActionBar>
        <ProduitFormDialog
          trigger={
            <Button size="lg">
              <Plus className="size-4" />
              Nouvelle prestation
            </Button>
          }
        />
      </MobileActionBar>
    </div>
  );
}
