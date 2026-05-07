"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import {
  createClientAction,
  updateClientAction,
} from "@/lib/actions/clients";
import { clientSchema, type ClientFormValues } from "@/lib/validations/client";
import { TYPES_CLIENT } from "@/lib/format";
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

type Client = Database["public"]["Tables"]["clients"]["Row"];

/**
 * Dialog (modal) de création ou édition d'un client.
 * Mode contrôlé par la présence de `client` (édition) ou non (création).
 */
export function ClientFormDialog({
  client,
  trigger,
  onClose,
}: {
  client?: Client;
  trigger?: React.ReactNode;
  onClose?: () => void;
}) {
  const isEdit = !!client;
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
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: defaultValuesFromClient(client),
  });

  const currentType = watch("type");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset(defaultValuesFromClient(client));
      onClose?.();
    }
  }

  async function onSubmit(values: ClientFormValues) {
    setSubmitting(true);
    const result = isEdit
      ? await updateClientAction(client!.id, values)
      : await createClientAction(values);
    setSubmitting(false);

    if (result.ok) {
      toast.success(isEdit ? "Client modifié" : "Client ajouté");
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
            Nouveau client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le client" : "Nouveau client"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mettez à jour les informations du client."
              : "Renseignez les informations du nouveau client."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="client-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="nom">Nom *</Label>
            <Input
              id="nom"
              autoFocus
              placeholder={
                currentType === "particulier"
                  ? "Ex : M. Jean Dupont"
                  : currentType === "syndic"
                    ? "Ex : Cabinet Foncia"
                    : "Ex : SARL Bâtiment & Co"
              }
              {...register("nom")}
            />
            {errors.nom && (
              <p className="text-xs text-destructive">{errors.nom.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">Type *</Label>
            <Select
              value={currentType}
              onValueChange={(value) =>
                setValue("type", value as ClientFormValues["type"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Type de client" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPES_CLIENT).map(([k, label]) => (
                  <SelectItem key={k} value={k}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-xs text-destructive">{errors.type.message}</p>
            )}
          </div>

          {currentType === "professionnel" && (
            <div className="space-y-1.5">
              <Label htmlFor="siret">SIRET *</Label>
              <Input
                id="siret"
                inputMode="numeric"
                placeholder="14 chiffres"
                {...register("siret")}
              />
              {errors.siret && (
                <p className="text-xs text-destructive">
                  {errors.siret.message}
                </p>
              )}
            </div>
          )}

          {(currentType === "professionnel" || currentType === "syndic") && (
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="raison_sociale">Raison sociale</Label>
              <Input
                id="raison_sociale"
                {...register("raison_sociale")}
              />
            </div>
          )}

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="adresse_ligne1">Adresse</Label>
            <Input id="adresse_ligne1" {...register("adresse_ligne1")} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="adresse_ligne2">Complément d'adresse</Label>
            <Input id="adresse_ligne2" {...register("adresse_ligne2")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code_postal">Code postal</Label>
            <Input
              id="code_postal"
              inputMode="numeric"
              maxLength={5}
              {...register("code_postal")}
            />
            {errors.code_postal && (
              <p className="text-xs text-destructive">
                {errors.code_postal.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ville">Ville</Label>
            <Input id="ville" {...register("ville")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input id="telephone" {...register("telephone")} />
            {errors.telephone && (
              <p className="text-xs text-destructive">
                {errors.telephone.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="client-form" disabled={submitting}>
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

function defaultValuesFromClient(client?: Client): ClientFormValues {
  return {
    nom: client?.nom ?? "",
    type:
      (client?.type as ClientFormValues["type"]) ?? "particulier",
    siret: client?.siret ?? "",
    raison_sociale: client?.raison_sociale ?? "",
    adresse_ligne1: client?.adresse_ligne1 ?? "",
    adresse_ligne2: client?.adresse_ligne2 ?? "",
    code_postal: client?.code_postal ?? "",
    ville: client?.ville ?? "",
    pays: client?.pays ?? "France",
    email: client?.email ?? "",
    telephone: client?.telephone ?? "",
    notes: client?.notes ?? "",
  };
}
