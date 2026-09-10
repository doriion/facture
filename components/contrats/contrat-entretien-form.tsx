"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  contratEntretienSchema,
  MODES_CONCLUSION,
  QUALITES_CLIENT,
  type ContratEntretienFormInput,
  type ContratEntretienFormValues,
} from "@/lib/validations/contrat-entretien";
import {
  createContratEntretienAction,
  updateContratEntretienAction,
  type ContratEntretienRow,
} from "@/lib/actions/contrats-entretien";
import {
  LABELS_MODE_CONCLUSION,
  LABELS_QUALITE,
  netAPayer,
} from "@/lib/contrats/logic";
import { equipementsDe } from "@/lib/contrats/rendu";
import { formatEuros, parseMoneyInput } from "@/lib/format";
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

import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];

const EQUIPEMENT_VIDE = {
  type: "",
  marque_modele: "",
  num_serie: "",
  puissance_kw: "",
  fluide_charge: "",
};

/**
 * Formulaire admin d'un contrat d'entretien (création + édition de
 * brouillon). Vos coordonnées ne se saisissent JAMAIS ici : elles
 * viennent des réglages et seront figées à l'envoi. Les champs du
 * client (occupant, contact site…) seront complétés par lui à la
 * signature.
 */
export function ContratEntretienForm({
  clients,
  contrat,
  clientIdInitial,
}: {
  clients: Client[];
  contrat?: ContratEntretienRow;
  clientIdInitial?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!contrat;
  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContratEntretienFormInput, unknown, ContratEntretienFormValues>({
    resolver: zodResolver(contratEntretienSchema),
    defaultValues: {
      client_id: contrat?.client_id ?? clientIdInitial ?? "",
      adresse_site: contrat?.adresse_site ?? "",
      equipements: contrat ? equipementsDe(contrat) : [{ ...EQUIPEMENT_VIDE }],
      redevance: contrat ? String(contrat.redevance) : "",
      remise: contrat ? String(contrat.remise) : "0",
      plafond_pieces: contrat ? String(contrat.plafond_pieces) : "20",
      date_effet: contrat?.date_effet ?? today,
      qualite_client:
        (contrat?.qualite_client as "particulier" | "professionnel") ??
        "particulier",
      mode_conclusion:
        (contrat?.mode_conclusion as ContratEntretienFormInput["mode_conclusion"]) ??
        "distance",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "equipements",
  });

  const clientId = watch("client_id");
  const qualite = watch("qualite_client");
  const redevanceSaisie = watch("redevance");
  const remiseSaisie = watch("remise");
  const net = netAPayer(
    safeMoney(redevanceSaisie),
    safeMoney(remiseSaisie),
  );

  async function onSubmit(values: ContratEntretienFormValues) {
    setSubmitting(true);
    if (isEdit) {
      const res = await updateContratEntretienAction(contrat.id, values);
      setSubmitting(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Contrat mis à jour.");
      router.push(`/contrats/${contrat.id}`);
    } else {
      const res = await createContratEntretienAction(values);
      setSubmitting(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Brouillon créé.");
      router.push(`/contrats/${res.data.id}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Client et site</CardTitle>
          <CardDescription>
            Vos coordonnées viennent des réglages — rien à saisir de votre
            côté. Le client complétera les siennes à la signature.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select
              value={clientId}
              onValueChange={(v) =>
                setValue("client_id", v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
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
            {errors.client_id && (
              <p className="text-xs text-destructive">
                {errors.client_id.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_effet">Date d'effet *</Label>
            <Input id="date_effet" type="date" {...register("date_effet")} />
            {errors.date_effet && (
              <p className="text-xs text-destructive">
                {errors.date_effet.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Qualité du client *</Label>
            <Select
              value={qualite}
              onValueChange={(v) =>
                setValue(
                  "qualite_client",
                  v as (typeof QUALITES_CLIENT)[number],
                  { shouldValidate: true },
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUALITES_CLIENT.map((q) => (
                  <SelectItem key={q} value={q}>
                    {LABELS_QUALITE[q]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Conditionne la loi Chatel, la rétractation et la clause de
              litiges du contrat.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Mode de conclusion *</Label>
            <Select
              value={watch("mode_conclusion")}
              onValueChange={(v) =>
                setValue(
                  "mode_conclusion",
                  v as (typeof MODES_CONCLUSION)[number],
                  { shouldValidate: true },
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES_CONCLUSION.map((m) => (
                  <SelectItem key={m} value={m}>
                    {LABELS_MODE_CONCLUSION[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Un envoi par email pour signature en ligne = « à distance »
              (rétractation 14 j pour un particulier).
            </p>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="adresse_site">
              Adresse du site d'intervention (si différente de l'adresse du
              client)
            </Label>
            <Textarea
              id="adresse_site"
              rows={2}
              {...register("adresse_site")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Installation couverte (art. 1.2)</CardTitle>
          <CardDescription>
            Seuls les équipements listés ici sont couverts par le contrat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-5"
            >
              <div className="space-y-1">
                <Label className="text-xs">Type d'équipement *</Label>
                <Input
                  placeholder="ex. PAC air/air"
                  {...register(`equipements.${index}.type`)}
                />
                {errors.equipements?.[index]?.type && (
                  <p className="text-xs text-destructive">
                    {errors.equipements[index]?.type?.message}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marque / Modèle</Label>
                <Input {...register(`equipements.${index}.marque_modele`)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° de série</Label>
                <Input {...register(`equipements.${index}.num_serie`)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Puissance (kW)</Label>
                <Input
                  placeholder="ex. 8"
                  {...register(`equipements.${index}.puissance_kw`)}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Fluide / charge</Label>
                  <Input
                    placeholder="ex. R32 — 1,2 kg"
                    {...register(`equipements.${index}.fluide_charge`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer cette ligne"
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {errors.equipements?.message && (
            <p className="text-xs text-destructive">
              {errors.equipements.message}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ ...EQUIPEMENT_VIDE })}
          >
            <Plus className="size-4" />
            Ajouter un équipement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conditions financières (art. 2.2 et 6)</CardTitle>
          <CardDescription>
            Montants nets — TVA non applicable, art. 293 B du CGI.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="redevance">Redevance annuelle (net) *</Label>
            <Input
              id="redevance"
              inputMode="decimal"
              placeholder="ex. 220"
              {...register("redevance")}
            />
            {errors.redevance && (
              <p className="text-xs text-destructive">
                {errors.redevance.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="remise">Remise éventuelle</Label>
            <Input id="remise" inputMode="decimal" {...register("remise")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plafond_pieces">
              Plafond petites pièces d'usure
            </Label>
            <Input
              id="plafond_pieces"
              inputMode="decimal"
              {...register("plafond_pieces")}
            />
            <p className="text-xs text-muted-foreground">
              Valeur unitaire max. des pièces remplacées sans facturation
              (joints, fusibles, filtres standard).
            </p>
          </div>
          <p className="text-sm font-medium sm:col-span-3">
            Net à payer par visite annuelle : {formatEuros(net)}
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isEdit ? "Enregistrer" : "Créer le brouillon"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

function safeMoney(v: unknown): number {
  try {
    const n = parseMoneyInput(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
