"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import {
  createInterventionAction,
  quickEditInterventionAction,
  deleteInterventionAction,
} from "@/lib/actions/interventions";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  DureeBadge,
  computeDureeJours,
} from "@/components/agenda/duree-badge";

export type ClientOption = { id: string; nom: string };

/**
 * Données minimales d'une intervention pour pré-remplir le dialogue
 * en mode édition. Couvre tous les champs gérés par ce dialogue rapide.
 */
export type InterventionEditData = {
  id: string;
  client_id: string;
  date_intervention: string;
  date_fin: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  type: string;
  description: string | null;
};

export function QuickInterventionDialog({
  open,
  onOpenChange,
  date,
  clients,
  editIntervention,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** YYYY-MM-DD — date pré-remplie en mode création */
  date: string;
  clients: ClientOption[];
  /** Si présent : mode édition (mise à jour de cette intervention) */
  editIntervention?: InterventionEditData;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(editIntervention);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InterventionFormInput, unknown, InterventionFormValues>({
    resolver: zodResolver(interventionSchema),
    defaultValues: editIntervention
      ? makeDefaultsFromIntervention(editIntervention)
      : makeDefaults(date),
  });

  // Réinitialise quand on change de date ou qu'on rouvre la modale (création),
  // ou quand on change d'intervention cible (édition).
  useEffect(() => {
    if (!open) return;
    reset(
      editIntervention
        ? makeDefaultsFromIntervention(editIntervention)
        : makeDefaults(date),
    );
  }, [open, date, editIntervention, reset]);

  const currentClient = watch("client_id");
  const currentType = watch("type");
  const currentStart = watch("date_intervention");
  const currentEnd = watch("date_fin");
  const dureeJours = computeDureeJours(currentStart, currentEnd);

  async function onSubmit(values: InterventionFormValues) {
    setSubmitting(true);
    const result = editIntervention
      ? await quickEditInterventionAction(editIntervention.id, {
          client_id: values.client_id,
          date_intervention: values.date_intervention,
          date_fin: values.date_fin || null,
          heure_debut: values.heure_debut || null,
          heure_fin: values.heure_fin || null,
          type: values.type,
          description: values.description || null,
        })
      : await createInterventionAction(values);
    setSubmitting(false);

    if (result.ok) {
      toast.success(isEdit ? "Intervention modifiée" : "Intervention planifiée");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function onDelete() {
    if (!editIntervention) return;
    setSubmitting(true);
    const result = await deleteInterventionAction(editIntervention.id);
    setSubmitting(false);
    if (result.ok) {
      toast.success("Intervention supprimée");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  const formattedDate = formatDateFr(currentStart || date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'intervention" : "Planifier une intervention"}
          </DialogTitle>
          <DialogDescription>
            {formattedDate}
            {isEdit ? null : (
              <>
                {" "}— vous pourrez compléter les détails (équipement, fluides
                frigo) depuis la fiche.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          id="quick-intervention-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
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
                <Label htmlFor="date_fin">
                  Date de fin (si plusieurs jours)
                </Label>
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
            <DureeBadge jours={dureeJours} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="heure_debut">Heure début (optionnel)</Label>
              <Input
                id="heure_debut"
                type="time"
                {...register("heure_debut")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="heure_fin">Heure fin (optionnel)</Label>
              <Input
                id="heure_fin"
                type="time"
                {...register("heure_fin")}
              />
              {errors.heure_fin && (
                <p className="text-xs text-destructive">
                  {errors.heure_fin.message}
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

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {isEdit && editIntervention ? (
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={submitting}
                  >
                    <Trash2 className="size-4" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Supprimer cette intervention ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/interventions/${editIntervention.id}`}>
                  <ExternalLink className="size-4" />
                  Fiche complète
                </Link>
              </Button>
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
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
              {isEdit ? "Enregistrer" : "Planifier"}
            </Button>
          </div>
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
    heure_debut: "",
    heure_fin: "",
    type: "installation",
    description: "",
    equipement_marque: "",
    equipement_modele: "",
    equipement_num_serie: "",
    fluide_frigo_type: "",
    fluide_frigo_kg_ajoute: null,
    fluide_frigo_kg_recupere: null,
    fluide_charge_totale_kg: null,
    duree_minutes: null,
    facture_id: null,
    notes: "",
  };
}

function makeDefaultsFromIntervention(
  it: InterventionEditData,
): InterventionFormInput {
  // Postgres renvoie les TIME au format "HH:MM:SS" — un input[type=time]
  // accepte "HH:MM" ou "HH:MM:SS", on garde tel quel.
  return {
    client_id: it.client_id,
    date_intervention: it.date_intervention,
    date_fin: it.date_fin ?? "",
    heure_debut: it.heure_debut ? it.heure_debut.slice(0, 5) : "",
    heure_fin: it.heure_fin ? it.heure_fin.slice(0, 5) : "",
    type: it.type as InterventionFormInput["type"],
    description: it.description ?? "",
    equipement_marque: "",
    equipement_modele: "",
    equipement_num_serie: "",
    fluide_frigo_type: "",
    fluide_frigo_kg_ajoute: null,
    fluide_frigo_kg_recupere: null,
    fluide_charge_totale_kg: null,
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
