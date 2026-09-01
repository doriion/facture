"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  devisSchema,
  type DevisFormInput,
  type DevisFormValues,
} from "@/lib/validations/devis";
import { isClimPac, type TypeActivite } from "@/lib/validations/facture";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";
import {
  createDevisAction,
  updateDevisAction,
} from "@/lib/actions/devis";
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
import type { NatureFiscale } from "@/lib/fiscal";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Produit = Database["public"]["Tables"]["produits_services"]["Row"];
type Devis = Database["public"]["Tables"]["devis"]["Row"];
type Ligne = Database["public"]["Tables"]["devis_lignes"]["Row"];

/**
 * Formulaire complet de devis (création ou édition).
 * Contient en plus du facture form : section travaux + performances énergétiques.
 *
 * `prefill` : valeurs initiales en mode création (duplication d'un
 * devis existant ou création depuis un modèle) — rien n'est créé en
 * base tant que l'utilisateur ne valide pas.
 */
export function DevisForm({
  clients,
  produits,
  devis,
  lignes,
  defaultConditions,
  prefill,
}: {
  clients: Client[];
  produits: Produit[];
  devis?: Devis;
  lignes?: Ligne[];
  defaultConditions?: string | null;
  prefill?: {
    devis: Partial<Devis>;
    lignes: Array<{
      designation: string;
      quantite: number;
      prix_unitaire_ht: number;
      nature_fiscale?: string;
      type?: string;
    }>;
  };
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!devis;

  // En édition, le devis existant prime ; en création, le prefill
  // éventuel (copie / modèle) fournit les valeurs initiales.
  const base = devis ?? (prefill?.devis as Devis | undefined);
  const baseLignes = devis
    ? (lignes ?? []).map((l) => ({
        id: l.id,
        designation: l.designation,
        quantite: Number(l.quantite),
        prix_unitaire_ht: Number(l.prix_unitaire_ht),
        nature_fiscale: (l.nature_fiscale ?? "bic_prestations") as NatureFiscale,
        type: (l.type ?? "ligne") as "ligne" | "titre",
      }))
    : (prefill?.lignes ?? []).map((l) => ({
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        nature_fiscale: (l.nature_fiscale ?? "bic_prestations") as NatureFiscale,
        type: ((l as { type?: string }).type ?? "ligne") as "ligne" | "titre",
      }));

  const today = new Date().toISOString().slice(0, 10);
  const inThreeMonths = new Date(Date.now() + 90 * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const equip = (base?.equipement_info ?? {}) as Record<string, unknown>;
  const perfs = (base?.performances_energetiques ?? {}) as Record<string, unknown>;
  const aides = (base?.aides_financieres ?? {}) as Record<string, unknown>;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DevisFormInput, unknown, DevisFormValues>({
    resolver: zodResolver(devisSchema),
    defaultValues: {
      client_id: base?.client_id ?? "",
      // Pas de pré-sélection en création : choix explicite exigé par le
      // schéma (les « autre » silencieux polluaient la répartition).
      type_activite:
        (base?.type_activite as DevisFormInput["type_activite"]) ??
        ("" as DevisFormInput["type_activite"]),
      date_emission: base?.date_emission ?? today,
      date_validite: base?.date_validite ?? inThreeMonths,
      date_debut_travaux: base?.date_debut_travaux ?? "",
      duree_estimee_jours: base?.duree_estimee_jours ?? null,
      conditions: base?.conditions ?? defaultConditions ?? "",
      notes: base?.notes ?? "",
      lignes: baseLignes,
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
      performances_energetiques: {
        cop: typeof perfs.cop === "number" ? perfs.cop : null,
        scop: typeof perfs.scop === "number" ? perfs.scop : null,
        seer: typeof perfs.seer === "number" ? perfs.seer : null,
        classe_energetique: (perfs.classe_energetique as string) ?? "",
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
  const showPerformances = isClimPac(currentType);

  async function onSubmit(values: DevisFormValues) {
    setSubmitting(true);
    if (isEdit) {
      const result = await updateDevisAction(devis!.id, values);
      setSubmitting(false);
      if (result.ok) {
        toast.success("Devis enregistré");
        router.refresh();
      } else {
        toast.error("Erreur", { description: result.error });
      }
    } else {
      const result = await createDevisAction(values);
      setSubmitting(false);
      if (result.ok) {
        toast.success(`Devis ${result.data.numero} créé`);
        router.push(`/devis/${result.data.id}`);
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
              setValue("type_activite", v as DevisFormInput["type_activite"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="md:max-w-md">
              <SelectValue placeholder="Choisir le type d'activité…" />
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
          <CardDescription>
            La validité par défaut est de 3 mois (modifiable).
          </CardDescription>
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
            <Label htmlFor="date_validite">Date de validité *</Label>
            <Input
              id="date_validite"
              type="date"
              {...register("date_validite")}
            />
            {errors.date_validite && (
              <p className="text-xs text-destructive">
                {errors.date_validite.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Travaux */}
      <Card>
        <CardHeader>
          <CardTitle>Travaux</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="date_debut">Date de début prévue</Label>
            <Input
              id="date_debut"
              type="date"
              {...register("date_debut_travaux")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duree">Durée estimée (jours)</Label>
            <Input
              id="duree"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="Ex : 3"
              {...register("duree_estimee_jours")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lignes */}
      <Card>
        <CardHeader>
          <CardTitle>Prestations</CardTitle>
          <CardDescription>
            Ajoutez les lignes du devis depuis votre catalogue ou en saisie libre.
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
            <CardTitle>Équipement proposé</CardTitle>
            <CardDescription>
              Caractéristiques de l'équipement à installer.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="equip_marque">Marque</Label>
              <Input id="equip_marque" {...register("equipement.marque")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="equip_modele">Modèle</Label>
              <Input id="equip_modele" {...register("equipement.modele")} />
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

      {/* Performances énergétiques */}
      {showPerformances && (
        <Card>
          <CardHeader>
            <CardTitle>Performances énergétiques</CardTitle>
            <CardDescription>
              Apparaissent sur le devis. Indispensables pour les dossiers
              MaPrimeRénov'/CEE et pour informer le client.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="perf_cop">COP</Label>
              <Input
                id="perf_cop"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Ex : 4,2"
                {...register("performances_energetiques.cop")}
              />
              <p className="text-xs text-muted-foreground">
                Coefficient de performance instantané.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="perf_scop">SCOP</Label>
              <Input
                id="perf_scop"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Ex : 4,0"
                {...register("performances_energetiques.scop")}
              />
              <p className="text-xs text-muted-foreground">
                Coefficient saisonnier (chauffage).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="perf_seer">SEER</Label>
              <Input
                id="perf_seer"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Ex : 7,5"
                {...register("performances_energetiques.seer")}
              />
              <p className="text-xs text-muted-foreground">
                Efficacité énergétique saisonnière (refroidissement).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="perf_classe">Classe énergétique</Label>
              <Input
                id="perf_classe"
                placeholder="A++, A+, A…"
                {...register("performances_energetiques.classe_energetique")}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Aides financières */}
      <Card>
        <CardHeader>
          <CardTitle>Aides financières (information client)</CardTitle>
          <CardDescription>
            Estimations qui apparaîtront sur le devis pour informer votre
            client du reste à charge.
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
            <Label htmlFor="conditions">Conditions</Label>
            <Textarea
              id="conditions"
              rows={3}
              placeholder="Conditions de paiement, réserves, garanties, etc."
              {...register("conditions")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (interne, n'apparaît pas sur le PDF)</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>
        </CardContent>
      </Card>

      {/* Barre d'enregistrement collante : alignée sur le padding du
          layout (p-3 mobile / p-6 desktop), safe-area iPhone incluse. */}
      <div className="sticky bottom-0 z-30 -mx-3 flex justify-end gap-2 border-t bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 sm:py-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/devis")}
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
          {isEdit ? "Enregistrer" : "Créer le devis"}
        </Button>
      </div>
    </form>
  );
}
