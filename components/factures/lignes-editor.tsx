"use client";

import { Plus, Trash2 } from "lucide-react";
import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type UseFormWatch,
  type FieldErrors,
  type FieldValues,
  type Path,
  type ArrayPath,
  type FieldArray,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEuros, parseMoneyInput } from "@/lib/format";
import type { Database } from "@/types/database";

/** Convertit une valeur de champ (string tolérant FR/EN) en number sûr. */
function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseMoneyInput(v);
  return Number.isFinite(n) ? n : 0;
}

type Produit = Database["public"]["Tables"]["produits_services"]["Row"];

type LigneShape = {
  id?: string;
  designation: string;
  quantite: number | string;
  prix_unitaire_ht: number | string;
};

/**
 * Éditeur générique de lignes pour facture ou devis (même structure).
 * Accepte n'importe quel form schema dont le champ `lignes` est un tableau
 * compatible avec `LigneShape`.
 */
export function LignesEditor<T extends FieldValues>({
  control,
  register,
  watch,
  errors,
  produits,
  fieldName = "lignes" as Path<T>,
}: {
  control: Control<T>;
  register: UseFormRegister<T>;
  watch: UseFormWatch<T>;
  errors: FieldErrors<T>;
  produits: Produit[];
  fieldName?: Path<T>;
}) {
  const { fields, append, remove } = useFieldArray<T>({
    control,
    name: fieldName as ArrayPath<T>,
  });

  // Cast pour pouvoir lire les valeurs typées sans s'embêter avec les Path<T>
  const lignes = (watch(fieldName) ?? []) as LigneShape[];

  function addEmptyLine() {
    append({
      designation: "",
      quantite: 1,
      prix_unitaire_ht: 0,
    } as unknown as FieldArray<T, ArrayPath<T>>);
  }

  function addFromCatalog(produitId: string) {
    const p = produits.find((p) => p.id === produitId);
    if (!p) return;
    const designation = p.description
      ? `${p.designation} — ${p.description}`
      : p.designation;
    append({
      designation,
      quantite: 1,
      prix_unitaire_ht: Number(p.prix_ht),
    } as unknown as FieldArray<T, ArrayPath<T>>);
  }

  const totalHt = lignes.reduce((sum, l) => {
    const q = toNum(l.quantite);
    const p = toNum(l.prix_unitaire_ht);
    return sum + q * p;
  }, 0);

  // Helper : récupère l'erreur d'une ligne donnée si elle existe
  const lignesErrorObj = errors[fieldName as keyof typeof errors] as
    | { message?: string; [k: string]: unknown }
    | undefined;
  function lineErr(index: number, key: "designation" | "quantite" | "prix_unitaire_ht") {
    const arr = lignesErrorObj as Array<Record<string, { message?: string }>> | undefined;
    return arr?.[index]?.[key]?.message;
  }

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Aucune ligne. Ajoutez-en une depuis votre catalogue ou en saisie libre.
        </div>
      )}

      {fields.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-12 gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div className="col-span-6">Désignation</div>
            <div className="col-span-2 text-right">Quantité</div>
            <div className="col-span-2 text-right">P.U. HT</div>
            <div className="col-span-1 text-right">Total HT</div>
            <div className="col-span-1" />
          </div>
          <div className="divide-y">
            {fields.map((field, index) => {
              const ligne = lignes[index];
              const lineTotal =
                toNum(ligne?.quantite) * toNum(ligne?.prix_unitaire_ht);
              const errDesignation = lineErr(index, "designation");
              const errQuantite = lineErr(index, "quantite");
              const errPrix = lineErr(index, "prix_unitaire_ht");
              return (
                <div
                  key={field.id}
                  className="grid grid-cols-12 items-start gap-2 px-3 py-2"
                >
                  <div className="col-span-6 space-y-1">
                    <Input
                      placeholder="Désignation de la prestation"
                      {...register(`${fieldName}.${index}.designation` as Path<T>)}
                    />
                    {errDesignation && (
                      <p className="text-xs text-destructive">{errDesignation}</p>
                    )}
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="1"
                      className="text-right"
                      {...register(`${fieldName}.${index}.quantite` as Path<T>)}
                    />
                    {errQuantite && (
                      <p className="text-xs text-destructive">{errQuantite}</p>
                    )}
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0,00"
                      className="text-right"
                      {...register(
                        `${fieldName}.${index}.prix_unitaire_ht` as Path<T>,
                      )}
                    />
                    {errPrix && (
                      <p className="text-xs text-destructive">{errPrix}</p>
                    )}
                  </div>
                  <div className="col-span-1 pt-2 text-right text-sm font-medium tabular-nums">
                    {formatEuros(lineTotal, { withSymbol: false })}
                  </div>
                  <div className="col-span-1 flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      title="Supprimer la ligne"
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-4 border-t bg-muted/30 px-4 py-3">
            <span className="text-sm text-muted-foreground">Total HT</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatEuros(totalHt)}
            </span>
          </div>
        </div>
      )}

      {typeof lignesErrorObj?.message === "string" && (
        <p className="text-sm text-destructive">{lignesErrorObj.message}</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" onClick={addEmptyLine}>
          <Plus className="size-4" />
          Ajouter une ligne libre
        </Button>

        {produits.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              Ou depuis le catalogue
            </Label>
            <Select onValueChange={addFromCatalog} value="">
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Choisir une prestation…" />
              </SelectTrigger>
              <SelectContent>
                {produits.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex w-full justify-between gap-3">
                      <span>{p.designation}</span>
                      <span className="text-muted-foreground">
                        {formatEuros(Number(p.prix_ht))} / {p.unite}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
