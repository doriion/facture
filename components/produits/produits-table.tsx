"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORIES_PRESTATIONS, formatEuros } from "@/lib/format";
import { ecrireAfficherCouts, lireAfficherCouts } from "@/lib/afficher-couts";
import { margeLigne } from "@/lib/marges";
import { duplicateProduitAction } from "@/lib/actions/produits";
import { ProduitFormDialog } from "@/components/produits/produit-form-dialog";
import { DeleteProduitDialog } from "@/components/produits/delete-produit-dialog";
import type { Database } from "@/types/database";

type Produit = Database["public"]["Tables"]["produits_services"]["Row"];

const categorieVariant: Record<
  string,
  "default" | "secondary" | "outline" | "warning"
> = {
  plomberie: "default",
  installation_clim: "secondary",
  installation_pac: "secondary",
  entretien: "outline",
  depannage: "warning",
  autre: "outline",
};

export function ProduitsTable({ produits }: { produits: Produit[] }) {
  const router = useRouter();
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Colonnes de coût sous le MÊME toggle que l'éditeur de lignes :
  // privé, masqué par défaut, l'état suit d'un écran à l'autre.
  const [afficherCouts, setAfficherCouts] = useState(false);
  useEffect(() => {
    setAfficherCouts(lireAfficherCouts());
  }, []);
  function basculerCouts() {
    setAfficherCouts((v) => {
      ecrireAfficherCouts(!v);
      return !v;
    });
  }

  async function onDuplicate(id: string) {
    setDuplicatingId(id);
    const result = await duplicateProduitAction(id);
    setDuplicatingId(null);
    if (result.ok) {
      toast.success("Prestation dupliquée");
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  if (produits.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        Aucune prestation. Cliquez sur « Nouvelle prestation » pour commencer.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={basculerCouts}
          className="text-muted-foreground"
        >
          {afficherCouts ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
          {afficherCouts ? "Masquer mes coûts" : "Afficher mes coûts"}
        </Button>
      </div>

      {/* Téléphone : cartes (le tableau à 6-9 colonnes débordait). */}
      <div className="space-y-2 md:hidden">
        {produits.map((p) => {
          const marge = afficherCouts ? margeLigne({ prix_unitaire_ht: Number(p.prix_ht), quantite: 1, prix_achat_ttc_unitaire: p.prix_achat_ttc ?? null }) : null;
          return (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{p.designation}</p>
                  {p.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  )}
                </div>
                <span className="shrink-0 text-right font-semibold tabular-nums">
                  {formatEuros(Number(p.prix_ht))}
                  <span className="block text-xs font-normal text-muted-foreground">/ {p.unite}</span>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={categorieVariant[p.categorie] ?? "default"}>
                  {CATEGORIES_PRESTATIONS[p.categorie as keyof typeof CATEGORIES_PRESTATIONS] ?? p.categorie}
                </Badge>
                {p.actif ? <Badge variant="success">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}
                {afficherCouts && p.prix_achat_ttc !== null && (
                  <span className="text-xs text-muted-foreground">
                    Achat {formatEuros(Number(p.prix_achat_ttc))}
                    {marge && marge.margeEuros !== null ? ` · marge ${formatEuros(marge.margeEuros)}` : ""}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDuplicate(p.id)}
                    disabled={duplicatingId === p.id}
                    aria-label={`Dupliquer ${p.designation}`}
                  >
                    <Copy className="size-4" />
                    Dupliquer
                  </Button>
                  <ProduitFormDialog
                    produit={p}
                    trigger={
                      <Button variant="ghost" size="sm" aria-label={`Modifier ${p.designation}`}>
                        <Pencil className="size-4" />
                        Modifier
                      </Button>
                    }
                  />
                </div>
                <DeleteProduitDialog produitId={p.id} designation={p.designation} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Désignation</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Prix unitaire</TableHead>
            {afficherCouts && (
              <>
                <TableHead className="text-right">Achat TTC</TableHead>
                <TableHead className="text-right">Marge</TableHead>
                <TableHead>Fournisseur</TableHead>
              </>
            )}
            <TableHead>Unité</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-[160px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produits.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <p className="font-medium">{p.designation}</p>
                {p.description && (
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {p.description}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={categorieVariant[p.categorie] ?? "default"}>
                  {CATEGORIES_PRESTATIONS[
                    p.categorie as keyof typeof CATEGORIES_PRESTATIONS
                  ] ?? p.categorie}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatEuros(Number(p.prix_ht))}
              </TableCell>
              {afficherCouts && <CellulesCouts produit={p} />}
              <TableCell className="text-sm text-muted-foreground">
                {p.unite}
              </TableCell>
              <TableCell>
                {p.actif ? (
                  <Badge variant="success">Actif</Badge>
                ) : (
                  <Badge variant="outline">Inactif</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDuplicate(p.id)}
                    disabled={duplicatingId === p.id}
                    title="Dupliquer"
                    aria-label={`Dupliquer ${p.designation}`}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <ProduitFormDialog
                    produit={p}
                    trigger={
                      <Button variant="ghost" size="icon" title="Modifier" aria-label={`Modifier ${p.designation}`}>
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <DeleteProduitDialog
                    produitId={p.id}
                    designation={p.designation}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

/**
 * Colonnes de coût PRIVÉES (achat TTC, marge, fournisseur), affichées
 * uniquement quand le toggle est actif. La marge réutilise le calcul
 * pur de lib/marges : coût absent → « — » plutôt qu'une marge de 100 %.
 */
function CellulesCouts({ produit }: { produit: Produit }) {
  const achat =
    produit.prix_achat_ttc === null || produit.prix_achat_ttc === undefined
      ? null
      : Number(produit.prix_achat_ttc);
  const marge = margeLigne({
    quantite: 1,
    prix_unitaire_ht: Number(produit.prix_ht),
    prix_achat_ttc_unitaire: achat,
  });

  return (
    <>
      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
        {achat === null ? "—" : formatEuros(achat)}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {marge.margeEuros === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={
              marge.margeEuros < 0 ? "text-destructive" : "text-emerald-600"
            }
          >
            {formatEuros(marge.margeEuros)}
            {marge.margePct !== null && (
              <span className="ml-1 text-xs text-muted-foreground">
                ({Math.round(marge.margePct)} %)
              </span>
            )}
          </span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {produit.fournisseur || "—"}
      </TableCell>
    </>
  );
}
