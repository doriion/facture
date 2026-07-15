"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  contratSchema,
  FREQUENCES,
  LABELS_FREQUENCE,
  LABELS_STATUT_CONTRAT,
  STATUTS_CONTRAT,
  nextVisitDate,
  pricePerVisit,
  type ContratFormInput,
  type ContratFormValues,
  type Frequence,
} from "@/lib/validations/contrat";
import {
  createContratAction,
  updateContratAction,
} from "@/lib/actions/contrats";
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
import { formatDateFr, formatEuros } from "@/lib/format";

import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Contrat = Database["public"]["Tables"]["contrats_maintenance"]["Row"];

export function ContratForm({
  clients,
  contrat,
}: {
  clients: Client[];
  contrat?: Contrat;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!contrat;

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContratFormInput, unknown, ContratFormValues>({
    resolver: zodResolver(contratSchema),
    defaultValues: {
      client_id: contrat?.client_id ?? "",
      intitule: contrat?.intitule ?? "",
      equipement: contrat?.equipement ?? "",
      equipement_num_serie: contrat?.equipement_num_serie ?? "",
      date_debut: contrat?.date_debut ?? today,
      date_fin: contrat?.date_fin ?? "",
      frequence:
        (contrat?.frequence as ContratFormInput["frequence"]) ?? "annuelle",
      prix_annuel_ht: contrat?.prix_annuel_ht ?? 0,
      prochaine_visite: contrat?.prochaine_visite ?? "",
      statut:
        (contrat?.statut as ContratFormInput["statut"]) ?? "actif",
      notes: contrat?.notes ?? "",
    },
  });

  const currentFrequence = watch("frequence") as Frequence;
  const currentPrix = Number(watch("prix_annuel_ht")) || 0;
  const currentDateDebut = watch("date_debut");
  const currentProchaine = watch("prochaine_visite");

  const prixVisite = currentPrix
    ? pricePerVisit(currentPrix, currentFrequence)
    : 0;

  // Suggestion automatique de prochaine_visite si vide et date_debut renseignée
  function suggererProchaineVisite() {
    if (!currentDateDebut) return;
    setValue(
      "prochaine_visite",
      nextVisitDate(currentDateDebut, currentFrequence),
      { shouldValidate: true },
    );
  }

  async function onSubmit(values: ContratFormValues) {
    setSubmitting(true);
    if (contrat) {
      const result = await updateContratAction(contrat.id, values);
      setSubmitting(false);
      if (result.ok) {
        toast.success("Contrat enregistré");
        router.refresh();
      } else {
        toast.error("Erreur", { description: result.error });
      }
    } else {
      const result = await createContratAction(values);
      setSubmitting(false);
      if (result.ok) {
        toast.success("Contrat créé");
        router.push(`/maintenance/${result.data.id}`);
      } else {
        toast.error("Erreur", { description: result.error });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Client et équipement</CardTitle>
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
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="intitule">Intitulé du contrat</Label>
            <Input
              id="intitule"
              placeholder="Ex : Entretien chaudière + clim"
              {...register("intitule")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="equipement">Équipement</Label>
            <Input
              id="equipement"
              placeholder="Ex : Daikin Altherma 3"
              {...register("equipement")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="equipement_num_serie">Numéro de série</Label>
            <Input
              id="equipement_num_serie"
              {...register("equipement_num_serie")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Période et fréquence</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="date_debut">Date de début *</Label>
            <Input id="date_debut" type="date" {...register("date_debut")} />
            {errors.date_debut && (
              <p className="text-xs text-destructive">
                {errors.date_debut.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_fin">Date de fin (optionnelle)</Label>
            <Input id="date_fin" type="date" {...register("date_fin")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="frequence">Fréquence *</Label>
            <Select
              value={currentFrequence}
              onValueChange={(v) =>
                setValue("frequence", v as ContratFormInput["frequence"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="frequence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {LABELS_FREQUENCE[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="statut">Statut</Label>
            <Select
              value={watch("statut")}
              onValueChange={(v) =>
                setValue("statut", v as ContratFormInput["statut"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUTS_CONTRAT.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LABELS_STATUT_CONTRAT[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="prochaine_visite">Prochaine visite</Label>
            <div className="flex gap-2">
              <Input
                id="prochaine_visite"
                type="date"
                className="flex-1"
                {...register("prochaine_visite")}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={suggererProchaineVisite}
              >
                Calculer auto
              </Button>
            </div>
            {currentProchaine && (
              <p className="text-xs text-muted-foreground">
                Prévue le{" "}
                <strong>{formatDateFr(currentProchaine)}</strong>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarification</CardTitle>
          <CardDescription>
            Le prix annuel sera divisé selon la fréquence pour facturer
            chaque visite.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prix_annuel_ht">Prix annuel HT *</Label>
            <div className="relative">
              <Input
                id="prix_annuel_ht"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0.00"
                className="pr-10"
                {...register("prix_annuel_ht")}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
            </div>
            {errors.prix_annuel_ht && (
              <p className="text-xs text-destructive">
                {errors.prix_annuel_ht.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Prix par visite</Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium tabular-nums">
                {formatEuros(prixVisite)}
              </span>{" "}
              <span className="text-xs text-muted-foreground">
                /{LABELS_FREQUENCE[currentFrequence].toLowerCase()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
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
          onClick={() => router.push("/maintenance")}
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
          {isEdit ? "Enregistrer" : "Créer le contrat"}
        </Button>
      </div>
    </form>
  );
}
