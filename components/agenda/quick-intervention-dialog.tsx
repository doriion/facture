"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { createInterventionAction } from "@/lib/actions/interventions";
import {
  interventionSchema,
  type InterventionFormInput,
  type InterventionFormValues,
  TYPES_INTERVENTION,
  LABELS_TYPE_INTERVENTION,
} from "@/lib/validations/intervention";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

export type ClientOption = { id: string; nom: string };

export function QuickInterventionDialog({
  open,
  onOpenChange,
  date,
  clients,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** YYYY-MM-DD — date pré-remplie */
  date: string;
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InterventionFormInput, unknown, InterventionFormValues>({
    resolver: zodResolver(interventionSchema),
    defaultValues: makeDefaults(date),
  });

  // Réinitialise quand on change de date ou qu'on rouvre la modale
  useEffect(() => {
    if (open) reset(makeDefaults(date));
  }, [open, date, reset]);

  const currentClient = watch("client_id");
  const currentType = watch("type");

  async function onSubmit(values: InterventionFormValues) {
    setSubmitting(true);
    const result = await createInterventionAction(values);
    setSubmitting(false);

    if (result.ok) {
      toast.success("Intervention planifiée");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  const formattedDate = formatDateFr(date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Planifier une intervention</DialogTitle>
          <DialogDescription>
            {formattedDate} — vous pourrez compléter les détails (équipement,
            fluides frigo, durée) depuis la fiche.
          </DialogDescription>
        </DialogHeader>

        <form
          id="quick-intervention-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date_intervention">Date (début) *</Label>
              <Input
                id="date_intervention"
                type="date"
                {...register("date_intervention")}
              />
              {errors.date_intervention && (
                <p className="text-xs text-destructive">
                  {errors.date_intervention.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date_fin">Date de fin (si plusieurs jours)</Label>
              <Input
                id="date_fin"
                type="date"
                {...register("date_fin")}
              />
              {errors.date_fin && (
                <p className="text-xs text-destructive">
                  {errors.date_fin.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client_id">Client *</Label>
            {clients.length === 0 ? (
              <p className="text-xs text-destructive">
                Aucun client. Créez d'abord un client depuis la page Clients.
              </p>
            ) : (
              <Select
                value={currentClient}
                onValueChange={(v) =>
                  setValue("client_id", v, { shouldValidate: true })
                }
              >
                <SelectTrigger id="client_id">
                  <SelectValue placeholder="Sélectionnez un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.client_id && (
              <p className="text-xs text-destructive">
                {errors.client_id.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">Type *</Label>
            <Select
              value={currentType}
              onValueChange={(v) =>
                setValue("type", v as InterventionFormValues["type"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES_INTERVENTION.map((t) => (
                  <SelectItem key={t} value={t}>
                    {LABELS_TYPE_INTERVENTION[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Ex : Remplacement ballon eau chaude 200 L"
              {...register("description")}
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            form="quick-intervention-form"
            disabled={submitting || clients.length === 0}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Planifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function makeDefaults(date: string): InterventionFormInput {
  return {
    client_id: "",
    date_intervention: date,
    date_fin: "",
    type: "installation",
    description: "",
    equipement_marque: "",
    equipement_modele: "",
    equipement_num_serie: "",
    fluide_frigo_type: "",
    fluide_frigo_kg_ajoute: null,
    fluide_frigo_kg_recupere: null,
    duree_minutes: null,
    facture_id: null,
    notes: "",
  };
}

function formatDateFr(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
