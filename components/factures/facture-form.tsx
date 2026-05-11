"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  factureSchema,
  isClimPac,
  type FactureFormInput,
  type FactureFormValues,
  type TypeActivite,
} from "@/lib/validations/facture";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";
import {
  createFactureAction,
  updateFactureAction,
} from "@/lib/actions/factures";
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
import { LignesEditor } from "@/components/factures/lignes-editor";

import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Produit = Database["public"]["Tables"]["produits_services"]["Row"];
type Facture = Database["public"]["Tables"]["factures"]["Row"];
type Ligne = Database["public"]["Tables"]["factures_lignes"]["Row"];

/**
 * Formulaire complet de facture (création ou édition).
 * Utilise react-hook-form + Zod avec les types entrée/sortie distincts
 * pour gérer la coercion (string → number) sur les champs numériques.
 */
export function FactureForm({
  clients,
  produits,
  facture,
  lignes,
  defaultConditionsPaiement,
}: {
  clients: Client[];
  produits: Produit[];
  facture?: Facture;
  lignes?: Ligne[];
  defaultConditionsPaiement?: string | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!facture;

  const today = new Date().toISOString().slice(0, 10);
  const inThirtyDays = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const equip = (facture?.equipement_info ?? {}) as Record<string, unknown>;
  const aides = (facture?.aides_financieres ?? {}) as Record<string, unknown>;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FactureFormInput, unknown, FactureFormValues>({
    resolver: zodResolver(factureSchema),
    defaultValues: {
      client_id: facture?.client_id ?? "",
      type_activite:
        (facture?.type_activite as FactureFormInput["type_activite"]) ??
        "plomberie",
      date_emission: facture?.date_emission ?? today,
      date_echeance: facture?.date_echeance ?? inThirtyDays,
      date_prestation: facture?.date_prestation ?? "",
      date_prestation_fin: facture?.date_prestation_fin ?? "",
      conditions_paiement:
        facture?.conditions_paiement ?? defaultConditionsPaiement ?? "",
      notes: facture?.notes ?? "",
      lignes: (lignes ?? []).map((l) => ({
        id: l.id,
        designation: l.designation,
        quantite: Number(l.quantite),
        prix_unitaire_ht: Number(l.prix_unitaire_ht),
      })),
      equipement: {
        marque: (equip.marque as string) ?? "",
        modele: (equip.modele as string) ?? "",
        num_serie: (equip.num_serie as string) ?? "",
        fluide_frigo_type: (equip.fluide_frigo_type as string) ?? "",
        fluide_frigo_kg:
          typeof equip.fluide_frigo_kg === "number"
            ? equip.fluide_frigo_kg
            : null,
      },
      aides_financieres: {
        maprimerenov:
          typeof aides.maprimerenov === "number" ? aides.maprimerenov : null,
        cee: typeof aides.cee === "number" ? aides.cee : null,
        eco_ptz: typeof aides.eco_ptz === "number" ? aides.eco_ptz : null,
      },
    },
  });

  const currentType = watch("type_activite") as TypeActivite;
  const showEquipement = isClimPac(currentType);

  async function onSubmit(values: FactureFormValues) {
    setSubmitting(true);
    if (isEdit) {
      const result = await updateFactureAction(facture!.id, values);
      setSubmitting(false);
      if (result.ok) {
        toast.success("Facture enregistrée");
        router.refresh();
      } else {
        toast.error("Erreur", { description: result.error });
      }
    } else {
      const result = await createFactureAction(values);
      setSubmitting(false);
      if (result.ok) {
        toast.success(`Facture ${result.data.numero} créée`);
        router.push(`/factures/${result.data.id}`);
      } else {
        toast.error("Erreur", { description: result.error });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Type d'activité */}
      <Card>
        <CardHeader>
          <CardTitle>Type d'activité</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={currentType}
            onValueChange={(v) =>
              setValue("type_activite", v as FactureFormInput["type_activite"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="md:max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LABELS_TYPE_ACTIVITE).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.type_activite && (
            <p className="mt-1 text-xs text-destructive">
              {errors.type_activite.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Client + dates */}
      <Card>
        <CardHeader>
          <CardTitle>Client et dates</CardTitle>
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
                {clients.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Aucun client. Créez-en un d'abord.
                  </div>
                ) : (
                  clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                      {c.ville && (
                        <span className="text-muted-foreground"> · {c.ville}</span>
                      )}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.client_id && (
              <p className="text-xs text-destructive">
                {errors.client_id.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_emission">Date d'émission *</Label>
            <Input
              id="date_emission"
              type="date"
              {...register("date_emission")}
            />
            {errors.date_emission && (
              <p className="text-xs text-destructive">
                {errors.date_emission.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_echeance">Date d'échéance *</Label>
            <Input
              id="date_echeance"
              type="date"
              {...register("date_echeance")}
            />
            {errors.date_echeance && (
              <p className="text-xs text-destructive">
                {errors.date_echeance.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_prestation">
              Date de prestation (début)
            </Label>
            <Input
              id="date_prestation"
              type="date"
              {...register("date_prestation")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_prestation_fin">
              Date de fin (si plusieurs jours)
            </Label>
            <Input
              id="date_prestation_fin"
              type="date"
              {...register("date_prestation_fin")}
            />
            {errors.date_prestation_fin && (
              <p className="text-xs text-destructive">
                {errors.date_prestation_fin.message}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2">
            Date(s) d'exécution effective des travaux. Pour un chantier d'un
            seul jour, laissez la date de fin vide.
          </p>
        </CardContent>
      </Card>

      {/* Lignes */}
      <Card>
        <CardHeader>
          <CardTitle>Prestations</CardTitle>
          <CardDescription>
            Ajoutez les lignes de la facture depuis votre catalogue ou en saisie libre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LignesEditor
            control={control}
            register={register}
            watch={watch}
            errors={errors}
            produits={produits}
          />
        </CardContent>
      </Card>

      {/* Équipement clim/PAC */}
      {showEquipement && (
        <Card>
          <CardHeader>
            <CardTitle>Équipement installé</CardTitle>
            <CardDescription>
              Spécifique aux installations clim/PAC. Le numéro de série et le
              type/quantité de fluide frigorigène sont demandés par la
              réglementation F-Gas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="equip_marque">Marque</Label>
              <Input
                id="equip_marque"
                placeholder="Daikin, Mitsubishi, Atlantic…"
                {...register("equipement.marque")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equip_modele">Modèle</Label>
              <Input
                id="equip_modele"
                placeholder="Altherma 3 R, Ecodan…"
                {...register("equipement.modele")}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="equip_serie">Numéro de série</Label>
              <Input id="equip_serie" {...register("equipement.num_serie")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equip_fluide_type">Type de fluide</Label>
              <Input
                id="equip_fluide_type"
                placeholder="R32, R454B, R290…"
                {...register("equipement.fluide_frigo_type")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equip_fluide_kg">
                Charge fluide frigorigène (kg)
              </Label>
              <Input
                id="equip_fluide_kg"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="1,4"
                {...register("equipement.fluide_frigo_kg")}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aides financières (optionnel pour facture) */}
      <Card>
        <CardHeader>
          <CardTitle>Aides financières (information)</CardTitle>
          <CardDescription>
            Affichage indicatif sur la facture si des aides ont été attribuées
            ou seront demandées par le client. Toutes en euros.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="aide_mpr">MaPrimeRénov'</Label>
            <Input
              id="aide_mpr"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00 €"
              {...register("aides_financieres.maprimerenov")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aide_cee">Certificats d'Économie d'Énergie</Label>
            <Input
              id="aide_cee"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00 €"
              {...register("aides_financieres.cee")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aide_ecoptz">Eco-PTZ</Label>
            <Input
              id="aide_ecoptz"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00 €"
              {...register("aides_financieres.eco_ptz")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Conditions + Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Conditions et notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="conditions">Conditions de paiement</Label>
            <Textarea
              id="conditions"
              rows={2}
              placeholder="Ex : Paiement à 30 jours par virement"
              {...register("conditions_paiement")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (interne, n'apparaît pas sur le PDF)</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/factures")}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {isEdit ? "Enregistrer" : "Créer la facture"}
        </Button>
      </div>
    </form>
  );
}
