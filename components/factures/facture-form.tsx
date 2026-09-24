"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";

import {
  factureSchema,
  isClimPac,
  type FactureFormInput,
  type FactureFormValues,
  type TypeActivite,
} from "@/lib/validations/facture";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";
import { aujourdhuiParis } from "@/lib/dates";
import { ajouterJours } from "@/lib/agenda-vues";
import { ClientPicker } from "@/components/clients/client-picker";
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
import type { NatureFiscale } from "@/lib/fiscal";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Produit = Database["public"]["Tables"]["produits_services"]["Row"];
type Facture = Database["public"]["Tables"]["factures"]["Row"];
type Ligne = Database["public"]["Tables"]["factures_lignes"]["Row"];

/**
 * Formulaire complet de facture (création ou édition).
 * Utilise react-hook-form + Zod avec les types entrée/sortie distincts
 * pour gérer la coercion (string → number) sur les champs numériques.
 *
 * `prefill` : valeurs initiales en mode création (facture pré-remplie
 * depuis une intervention). `interventionId` : lie l'intervention à la
 * facture au moment de la création.
 */
export function FactureForm({
  clients,
  produits,
  facture,
  lignes,
  defaultConditionsPaiement,
  prefill,
  interventionId,
  assujettiTva = false,
  verrouillee = false,
  avoir = false,
}: {
  clients: Client[];
  produits: Produit[];
  facture?: Facture;
  lignes?: Ligne[];
  defaultConditionsPaiement?: string | null;
  /** Libellés « HT » uniquement si le document est assujetti (snapshot). */
  assujettiTva?: boolean;
  prefill?: {
    facture: Partial<Facture>;
    lignes: Array<{
      designation: string;
      quantite: number;
      prix_unitaire_ht: number;
      nature_fiscale?: string | null;
      type?: string | null;
      prix_achat_ttc_unitaire?: number | null;
      fournisseur?: string | null;
    }>;
  };
  interventionId?: string;
  /** Facture émise : tout est affiché mais rien n'est modifiable. */
  verrouillee?: boolean;
  /** Avoir : ni échéance, ni relances, ni détails techniques, ni conditions. */
  avoir?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!facture;

  // En édition, la facture existante prime ; en création, le prefill
  // éventuel (intervention) fournit les valeurs initiales.
  const base = facture ?? (prefill?.facture as Facture | undefined);
  const baseLignes = facture
    ? (lignes ?? []).map((l) => ({
        id: l.id,
        designation: l.designation,
        quantite: Number(l.quantite),
        prix_unitaire_ht: Number(l.prix_unitaire_ht),
        prix_achat_ttc_unitaire:
          l.prix_achat_ttc_unitaire === null || l.prix_achat_ttc_unitaire === undefined
            ? null
            : Number(l.prix_achat_ttc_unitaire),
        fournisseur: l.fournisseur ?? "",
        nature_fiscale: (l.nature_fiscale ?? "bic_prestations") as NatureFiscale,
        type: (l.type ?? "ligne") as "ligne" | "titre",
      }))
    : (prefill?.lignes ?? []).map((l) => ({
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        prix_achat_ttc_unitaire:
          l.prix_achat_ttc_unitaire === null || l.prix_achat_ttc_unitaire === undefined
            ? null
            : Number(l.prix_achat_ttc_unitaire),
        fournisseur: l.fournisseur ?? "",
        nature_fiscale: (l.nature_fiscale ?? "bic_prestations") as NatureFiscale,
        type: (l.type ?? "ligne") as "ligne" | "titre",
      }));

  // Date du jour en heure de Paris : à 0 h 30, la date UTC du téléphone
  // (toISOString) était encore la veille.
  const today = aujourdhuiParis();
  const inThirtyDays = ajouterJours(today, 30);

  const equip = (base?.equipement_info ?? {}) as Record<string, unknown>;
  const aides = (base?.aides_financieres ?? {}) as Record<string, unknown>;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FactureFormInput, unknown, FactureFormValues>({
    resolver: zodResolver(factureSchema),
    defaultValues: {
      client_id: base?.client_id ?? "",
      // Pas de pré-sélection en création : choix explicite exigé par le
      // schéma (les « autre » silencieux polluaient la répartition).
      type_activite:
        (base?.type_activite as FactureFormInput["type_activite"]) ??
        ("" as FactureFormInput["type_activite"]),
      date_emission: base?.date_emission ?? today,
      date_echeance: base?.date_echeance ?? inThirtyDays,
      date_prestation: base?.date_prestation ?? "",
      date_prestation_fin: base?.date_prestation_fin ?? "",
      conditions_paiement:
        base?.conditions_paiement ?? defaultConditionsPaiement ?? "",
      adresse_chantier: base?.adresse_chantier ?? "",
      notes: base?.notes ?? "",
      exclure_relances_auto: base?.exclure_relances_auto ?? false,
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
  // Bloc « Détails techniques » ouvert d'emblée s'il contient déjà quelque chose.
  const detailsRemplis = Boolean(
    equip.marque || equip.modele || equip.num_serie || equip.fluide_frigo_type ||
    typeof aides.maprimerenov === "number" || typeof aides.cee === "number" || typeof aides.eco_ptz === "number",
  );

  // Validation refusée : sur le téléphone, l'erreur sous un champ hors
  // écran est invisible — on prévient et on y amène.
  function onInvalid(errs: Record<string, unknown>) {
    const premier = Object.keys(errs)[0];
    const labels: Record<string, string> = {
      client_id: "le client",
      type_activite: "le type d'activité",
      lignes: "les lignes",
      date_emission: "la date d'émission",
      date_echeance: "la date d'échéance",
    };
    toast.error("Facture incomplète", {
      description: premier
        ? `Vérifiez ${labels[premier] ?? `le champ « ${premier} »`}.`
        : "Vérifiez les champs signalés.",
    });
    document
      .querySelector<HTMLElement>("[aria-invalid='true'], .text-destructive")
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function onSubmit(values: FactureFormValues) {
    if (verrouillee) return;
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
      const result = await createFactureAction(
        values,
        interventionId ? { interventionId } : undefined,
      );
      setSubmitting(false);
      if (result.ok) {
        const id = result.data.id;
        toast.success(`Facture ${result.data.numero} créée`, {
          description: "En brouillon : vérifiez, puis marquez-la envoyée.",
          action: {
            label: "Voir le PDF",
            onClick: () => window.open(`/api/factures/${id}/pdf`, "_blank", "noopener"),
          },
        });
        router.push(`/factures/${id}`);
      } else {
        toast.error("Erreur", { description: result.error });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      {verrouillee && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>
            Facture émise : son contenu est figé (document comptable).
            Pour corriger, utilisez « Repasser en brouillon » dans les
            actions — le numéro est conservé.
          </p>
        </div>
      )}
      <fieldset disabled={verrouillee} className="min-w-0 space-y-6">
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
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="client_id">Client *</Label>
            {/* Même sélecteur que le devis : recherche instantanée et
                création d'un nouveau client sans quitter la facture. */}
            <ClientPicker
              clients={clients}
              value={watch("client_id")}
              onChange={(v) =>
                setValue("client_id", v, { shouldValidate: true })
              }
              error={errors.client_id?.message}
            />
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
          <div className={avoir ? "hidden" : "space-y-1.5"}>
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
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="adresse_chantier">Adresse du chantier (si différente du client)</Label>
            <Input
              id="adresse_chantier"
              placeholder="Ex : 12 rue des Alpes, 38000 Grenoble"
              autoComplete="off"
              {...register("adresse_chantier")}
            />
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
          <label className={avoir ? "hidden" : "flex items-start gap-2 md:col-span-2"}>
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              {...register("exclure_relances_auto")}
            />
            <span className="text-sm">
              Exclure des relances automatiques
              <span className="block text-xs text-muted-foreground">
                Cette facture ne recevra jamais de relance d'impayé
                automatique (client à relancer de vive voix).
              </span>
            </span>
          </label>
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
            setValue={setValue}
            errors={errors}
            produits={produits}
            assujettiTva={assujettiTva}
          />
        </CardContent>
      </Card>

      {/* Détails techniques : équipement clim/PAC et aides financières.
          Repliés par défaut (encombrants pour un dépannage), dépliés si
          déjà renseignés ; le contenu reste MONTÉ pour ne rien perdre. */}
      <details className={avoir ? "hidden" : "group rounded-lg border bg-card"} open={detailsRemplis}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 font-semibold">
          <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
          Détails techniques (optionnel)
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {showEquipement ? "équipement, aides financières" : "aides financières"}
          </span>
        </summary>
        <div className="space-y-6 border-t p-6 pt-4">
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

        </div>
      </details>

      {/* Conditions + Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Conditions et notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={avoir ? "hidden" : "space-y-1.5"}>
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

      {/* Barre d'enregistrement collante : alignée sur le padding du
          layout (p-3 mobile / p-6 desktop), safe-area iPhone incluse. */}
      </fieldset>
      {!verrouillee && (
      <div className="sticky bottom-0 z-30 -mx-3 flex justify-end gap-2 border-t bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 sm:py-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (isDirty && !window.confirm("Quitter sans enregistrer ? Les modifications seront perdues.")) return;
            router.push("/factures");
          }}
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
          {isEdit ? "Enregistrer" : "Créer la facture"}
        </Button>
      </div>
      )}
    </form>
  );
}
