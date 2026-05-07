"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import {
  createProduitAction,
  updateProduitAction,
} from "@/lib/actions/produits";
import {
  produitSchema,
  type ProduitFormInput,
  type ProduitFormValues,
} from "@/lib/validations/produit";
import { CATEGORIES_PRESTATIONS, UNITES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Database } from "@/types/database";

type Produit = Database["public"]["Tables"]["produits_services"]["Row"];

export function ProduitFormDialog({
  produit,
  trigger,
}: {
  produit?: Produit;
  trigger?: React.ReactNode;
}) {
  const isEdit = !!produit;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProduitFormInput, unknown, ProduitFormValues>({
    resolver: zodResolver(produitSchema),
    defaultValues: defaultValues(produit),
  });

  const currentCategorie = watch("categorie");
  const currentUnite = watch("unite");
  const currentActif = watch("actif");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset(defaultValues(produit));
  }

  async function onSubmit(values: ProduitFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateProduitAction(produit!.id, values)
      : await createProduitAction(values);
    setSubmitting(false);

    if (result.ok) {
      toast.success(isEdit ? "Prestation modifiée" : "Prestation ajoutée");
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            Nouvelle prestation
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la prestation" : "Nouvelle prestation"}
          </DialogTitle>
          <DialogDescription>
            Cette prestation sera proposée lors de la création de factures et devis.
          </DialogDescription>
        </DialogHeader>

        <form
          id="produit-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="designation">Désignation *</Label>
            <Input
              id="designation"
              autoFocus
              placeholder="Ex : Installation chaudière gaz à condensation"
              {...register("designation")}
            />
            {errors.designation && (
              <p className="text-xs text-destructive">
                {errors.designation.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categorie">Catégorie *</Label>
            <Select
              value={currentCategorie}
              onValueChange={(v) =>
                setValue("categorie", v as ProduitFormValues["categorie"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="categorie">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIES_PRESTATIONS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unite">Unité *</Label>
            <Select
              value={currentUnite}
              onValueChange={(v) =>
                setValue("unite", v as ProduitFormValues["unite"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="unite">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prix_ht">Prix unitaire HT *</Label>
            <div className="relative">
              <Input
                id="prix_ht"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0,00"
                className="pr-10"
                {...register("prix_ht")}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
            </div>
            {errors.prix_ht && (
              <p className="text-xs text-destructive">
                {errors.prix_ht.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tva_taux_suggere">
              TVA suggérée (information)
            </Label>
            <div className="relative">
              <Input
                id="tva_taux_suggere"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="—"
                className="pr-10"
                {...register("tva_taux_suggere")}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Pour info uniquement (vous êtes en franchise TVA).
            </p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Détails optionnels qui apparaîtront sur les documents"
              {...register("description")}
            />
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              id="actif"
              checked={currentActif}
              onChange={(e) => setValue("actif", e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            <Label htmlFor="actif" className="cursor-pointer">
              Actif (proposé lors de la création de documents)
            </Label>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="produit-form" disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultValues(p?: Produit): ProduitFormInput {
  return {
    designation: p?.designation ?? "",
    description: p?.description ?? "",
    prix_ht: p?.prix_ht ?? 0,
    unite: (p?.unite as ProduitFormInput["unite"]) ?? "unité",
    categorie:
      (p?.categorie as ProduitFormInput["categorie"]) ?? "plomberie",
    tva_taux_suggere: p?.tva_taux_suggere ?? null,
    actif: p?.actif ?? true,
  };
}
