"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  interventionSchema,
  LABELS_TYPE_INTERVENTION,
  TYPES_INTERVENTION,
  type InterventionFormInput,
  type InterventionFormValues,
} from "@/lib/validations/intervention";
import {
  createInterventionAction,
  updateInterventionAction,
} from "@/lib/actions/interventions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Intervention = Database["public"]["Tables"]["interventions"]["Row"];

export function InterventionForm({
  clients,
  intervention,
}: {
  clients: Client[];
  intervention?: Intervention;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!intervention;

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InterventionFormInput, unknown, InterventionFormValues>({
    resolver: zodResolver(interventionSchema),
    defaultValues: {
      client_id: intervention?.client_id ?? "",
      date_intervention: intervention?.date_intervention ?? today,
      date_fin: intervention?.date_fin ?? "",
      heure_debut: intervention?.heure_debut
        ? intervention.heure_debut.slice(0, 5)
        : "",
      heure_fin: intervention?.heure_fin
        ? intervention.heure_fin.slice(0, 5)
        : "",
      type:
        (intervention?.type as InterventionFormInput["type"]) ?? "entretien",
      description: intervention?.description ?? "",
      equipement_marque: intervention?.equipement_marque ?? "",
      equipement_modele: intervention?.equipement_modele ?? "",
      equipement_num_serie: intervention?.equipement_num_serie ?? "",
      fluide_frigo_type: intervention?.fluide_frigo_type ?? "",
      fluide_frigo_kg_ajoute: intervention?.fluide_frigo_kg_ajoute ?? null,
      fluide_frigo_kg_recupere: intervention?.fluide_frigo_kg_recupere ?? null,
      duree_minutes: intervention?.duree_minutes ?? null,
      facture_id: intervention?.facture_id ?? null,
      notes: intervention?.notes ?? "",
    },
  });

  async function onSubmit(values: InterventionFormValues) {
    setSubmitting(true);
    if (intervention) {
      const result = await updateInterventionAction(intervention.id, values);
      setSubmitting(false);
      if (result.ok) {
        toast.success("Intervention enregistrée");
        router.refresh();
      } else {
        toast.error("Erreur", { description: result.error });
      }
    } else {
      const result = await createInterventionAction(values);
      setSubmitting(false);
      if (result.ok) {
        toast.success("Intervention créée");
        router.push(`/interventions/${result.data.id}`);
      } else {
        toast.error("Erreur", { description: result.error });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="client_id">Client *</Label>
            <Select
              value={watch("client_id")}
              onValueChange={(v) =>
                setValue("client_id", v, { shouldValidate: true })
              }
            >
              <SelectTrigger id="client_id">
                <SelectValue placeholder="Sélectionner un client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom}
                    {c.ville && (
                      <span className="text-muted-foreground"> · {c.ville}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.client_id && (
              <p className="text-xs text-destructive">
                {errors.client_id.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_intervention">Date d'intervention *</Label>
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
          <div className="md:col-span-2">
            <DureeBadge
              jours={computeDureeJours(watch("date_intervention"), watch("date_fin"))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="heure_debut">Heure début (optionnel)</Label>
            <Input
              id="heure_debut"
              type="time"
              {...register("heure_debut")}
            />
            <p className="text-xs text-muted-foreground">
              Ex : 09:00 — pour planifier sur l'agenda à une heure précise.
            </p>
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
          <div className="space-y-1.5">
            <Label htmlFor="type">Type *</Label>
            <Select
              value={watch("type")}
              onValueChange={(v) =>
                setValue("type", v as InterventionFormInput["type"], {
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
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="description">Description / résumé</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Détail de ce qui a été fait sur place"
              {...register("description")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duree_minutes">Durée (minutes)</Label>
            <Input
              id="duree_minutes"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="60"
              {...register("duree_minutes")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Équipement intervenu</CardTitle>
          <CardDescription>
            Trace l'équipement spécifique pour le suivi sur la durée.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="marque">Marque</Label>
            <Input
              id="marque"
              placeholder="Daikin, Mitsubishi…"
              {...register("equipement_marque")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="modele">Modèle</Label>
            <Input id="modele" {...register("equipement_modele")} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="serie">Numéro de série</Label>
            <Input id="serie" {...register("equipement_num_serie")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fluides frigorigènes (F-Gas)</CardTitle>
          <CardDescription>
            Bilan obligatoire pour les contrôles réglementaires : type de
            fluide, kg ajoutés et kg récupérés sur cette intervention.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="fluide_type">Type de fluide</Label>
            <Input
              id="fluide_type"
              placeholder="R32, R454B, R290…"
              {...register("fluide_frigo_type")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kg_ajoute">Kg ajoutés</Label>
            <Input
              id="kg_ajoute"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              placeholder="0.000"
              {...register("fluide_frigo_kg_ajoute")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kg_recupere">Kg récupérés</Label>
            <Input
              id="kg_recupere"
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              placeholder="0.000"
              {...register("fluide_frigo_kg_recupere")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes (interne)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={3} {...register("notes")} />
        </CardContent>
      </Card>

      {/* Barre d'enregistrement collante : alignée sur le padding du
          layout (p-3 mobile / p-6 desktop), safe-area iPhone incluse. */}
      <div className="sticky bottom-0 z-30 -mx-3 flex justify-end gap-2 border-t bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 sm:py-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/interventions")}
        >
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          size="lg"
          className="flex-1 sm:flex-initial"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isEdit ? "Enregistrer" : "Créer l'intervention"}
        </Button>
      </div>
    </form>
  );
}
