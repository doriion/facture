"use client";

import { useMemo } from "react";

import { filtrerProduits } from "@/lib/filtres-listes";
import { ProduitsTable } from "@/components/produits/produits-table";
import { ProduitsToolbar, type FiltresProduitsUi } from "@/components/produits/produits-toolbar";
import { useFiltresListe } from "@/components/liste-filtree";

type Produit = React.ComponentProps<typeof ProduitsTable>["produits"][number];

/**
 * Catalogue : recherche et catégorie filtrent SUR PLACE (comme devis,
 * factures, clients) — le catalogue était le seul écran à relancer une
 * navigation serveur à chaque lettre tapée.
 */
export function ProduitsListe({ produits, initial }: { produits: Produit[]; initial: FiltresProduitsUi }) {
  const [filtres, setFiltres] = useFiltresListe("/produits", initial);
  const filtres_ = useMemo(() => filtrerProduits(produits, filtres), [produits, filtres]);
  return (
    <div className="space-y-6">
      <ProduitsToolbar filtres={filtres} onChange={setFiltres} />
      <p className="text-sm text-muted-foreground">
        {filtres_.length} prestation{filtres_.length > 1 ? "s" : ""}
        {filtres_.length !== produits.length ? ` sur ${produits.length}` : ""}.
      </p>
      <ProduitsTable produits={filtres_} />
    </div>
  );
}
