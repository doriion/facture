"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil } from "lucide-react";
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
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Désignation</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead className="text-right">Prix HT</TableHead>
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
                  >
                    <Copy className="size-4" />
                  </Button>
                  <ProduitFormDialog
                    produit={p}
                    trigger={
                      <Button variant="ghost" size="icon" title="Modifier">
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
  );
}
