import { listProduits } from "@/lib/actions/produits";
import { ProduitFormDialog } from "@/components/produits/produit-form-dialog";
import { ProduitsTable } from "@/components/produits/produits-table";
import { ProduitsToolbar } from "@/components/produits/produits-toolbar";

export const metadata = { title: "Catalogue — Facture AE" };

/**
 * Catalogue de prestations réutilisables (plomberie, clim, PAC, entretien, dépannage).
 */
export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: { search?: string; categorie?: string };
}) {
  const search = searchParams.search ?? "";
  const categorie = searchParams.categorie ?? "";

  // En Phase 2 on n'expose pas le filtre actif/inactif ; on inclut tout.
  const produits = await listProduits({
    search,
    categorie,
    inclureInactifs: true,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Prestations et tarifs réutilisables sur vos factures et devis.
          </p>
        </div>
        <ProduitFormDialog />
      </div>

      <ProduitsToolbar
        initialSearch={search}
        initialCategorie={categorie}
      />

      <ProduitsTable produits={produits} />
    </div>
  );
}
