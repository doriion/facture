"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, Loader2, Save, Wrench } from "lucide-react";
import { toast } from "sonner";

import { aujourdhuiParis } from "@/lib/dates";
import { appelerAction } from "@/lib/appel-action";
import { dureeDepuisHeures, formatDuree } from "@/lib/interventions-helpers";
import type { EquipementClient } from "@/lib/equipements-client";

import {
  interventionSchema,
  LABELS_TYPE_INTERVENTION,
  TYPES_INTERVENTION,
  type InterventionFormInput,
  type InterventionFormValues,
} from "@/lib/validations/intervention";
import {
  createInterventionAction,
  listEquipementsClientAction,
  updateInterventionAction,
} from "@/lib/actions/interventions";
import { ClientPicker } from "@/components/clients/client-picker";
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
import {
  equivalentCo2Tonnes,
  formatEquivalentCo2,
  periodiciteControleMois,
  prgFluide,
} from "@/lib/fluides";

import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Intervention = Database["public"]["Tables"]["interventions"]["Row"];

/**
 * Pré-remplissage à la création (« planifier la prochaine visite » depuis
 * une intervention passée) : même client, même matériel, même fluide.
 */
export type InterventionPrefill = Partial<
  Pick<
    Intervention,
    | "client_id"
    | "type"
    | "description"
    | "equipement_marque"
    | "equipement_modele"
    | "equipement_num_serie"
    | "fluide_frigo_type"
    | "fluide_charge_totale_kg"
  >
>;

function rempli(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

export function InterventionForm({
  clients,
  intervention,
  clientIdParDefaut,
  prefill,
}: {
  clients: Client[];
  intervention?: Intervention;
  /** Création depuis une fiche client : client déjà choisi. */
  clientIdParDefaut?: string;
  prefill?: InterventionPrefill;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!intervention;
  const base = intervention ?? prefill;

  // Heure de Paris : à 0 h 30, la date UTC du téléphone était la veille.
  const today = aujourdhuiParis();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InterventionFormInput, unknown, InterventionFormValues>({
    resolver: zodResolver(interventionSchema),
    defaultValues: {
      client_id: intervention?.client_id ?? clientIdParDefaut ?? prefill?.client_id ?? "",
      date_intervention: intervention?.date_intervention ?? today,
      date_fin: intervention?.date_fin ?? "",
      heure_debut: intervention?.heure_debut
        ? intervention.heure_debut.slice(0, 5)
        : "",
      heure_fin: intervention?.heure_fin
        ? intervention.heure_fin.slice(0, 5)
        : "",
      type: (base?.type as InterventionFormInput["type"]) ?? "entretien",
      description: base?.description ?? "",
      equipement_marque: base?.equipement_marque ?? "",
      equipement_modele: base?.equipement_modele ?? "",
      equipement_num_serie: base?.equipement_num_serie ?? "",
      fluide_frigo_type: base?.fluide_frigo_type ?? "",
      fluide_frigo_kg_ajoute: intervention?.fluide_frigo_kg_ajoute ?? null,
      fluide_frigo_kg_recupere: intervention?.fluide_frigo_kg_recupere ?? null,
      fluide_charge_totale_kg: base?.fluide_charge_totale_kg ?? null,
      etancheite_controle: intervention?.etancheite_controle ?? null,
      etancheite_detecteur: intervention?.etancheite_detecteur ?? "",
      etancheite_detecteur_controle_le:
        intervention?.etancheite_detecteur_controle_le ?? "",
      etancheite_fuite: intervention?.etancheite_fuite ?? null,
      etancheite_fuite_localisation:
        intervention?.etancheite_fuite_localisation ?? "",
      fluide_observations: intervention?.fluide_observations ?? "",
      duree_minutes: intervention?.duree_minutes ?? null,
      facture_id: intervention?.facture_id ?? null,
      notes: intervention?.notes ?? "",
      a_facturer: intervention?.a_facturer ?? true,
    },
  });

  const clientId = watch("client_id") || "";
  const heureDebut = watch("heure_debut");
  const heureFin = watch("heure_fin");
  const dureeSaisie = watch("duree_minutes");
  const dureeDeduite = dureeDepuisHeures(heureDebut, heureFin);

  // Matériel déjà vu chez ce client : un tap pour le reprendre au lieu
  // de retaper marque / modèle / n° de série (et le fluide).
  const [equipements, setEquipements] = useState<EquipementClient[]>([]);
  useEffect(() => {
    let annule = false;
    if (!clientId) {
      setEquipements([]);
      return;
    }
    appelerAction(() => listEquipementsClientAction(clientId)).then((r) => {
      if (!annule) setEquipements(r.ok ? r.data : []);
    });
    return () => {
      annule = true;
    };
  }, [clientId]);

  function reprendreEquipement(e: EquipementClient) {
    setValue("equipement_marque", e.marque ?? "", { shouldDirty: true });
    setValue("equipement_modele", e.modele ?? "", { shouldDirty: true });
    setValue("equipement_num_serie", e.numSerie ?? "", { shouldDirty: true });
    if (e.fluide && !watch("fluide_frigo_type")) {
      setValue("fluide_frigo_type", e.fluide, { shouldDirty: true });
    }
    toast.success("Matériel repris", {
      description: [e.marque, e.modele, e.numSerie].filter(Boolean).join(" · "),
    });
  }

  // Le bloc F-Gas ne concerne que la clim / PAC : replié tant qu'il est
  // vide, pour que la fiche d'un dépannage plomberie tienne sur l'écran.
  const [fluideOuvert, setFluideOuvert] = useState(() =>
    [
      base?.fluide_frigo_type,
      intervention?.fluide_frigo_kg_ajoute,
      intervention?.fluide_frigo_kg_recupere,
      base?.fluide_charge_totale_kg,
      intervention?.etancheite_controle,
      intervention?.fluide_observations,
    ].some(rempli),
  );

  // Validation refusée : sur le téléphone, l'erreur sous un champ hors
  // écran est invisible — on prévient et on y amène.
  function onInvalid(errs: Record<string, unknown>) {
    const premier = Object.keys(errs)[0];
    const labels: Record<string, string> = {
      date_intervention: "la date",
      type: "le type d'intervention",
      client_id: "le client",
      heure_fin: "l'heure de fin",
    };
    toast.error("Intervention incomplète", {
      description: premier ? `Vérifiez ${labels[premier] ?? `le champ « ${premier} »`}.` : "Vérifiez les champs signalés.",
    });
    document
      .querySelector<HTMLElement>("[aria-invalid='true'], .text-destructive")
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function onSubmit(valeurs: InterventionFormValues) {
    // Durée non saisie mais heures connues : on la déduit (une info de
    // moins à taper, et le temps passé est juste dans les bilans).
    const values =
      valeurs.duree_minutes === null && dureeDeduite !== null
        ? { ...valeurs, duree_minutes: dureeDeduite }
        : valeurs;
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
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="client_id">Client</Label>
            {/* Même sélecteur que devis / facture : recherche instantanée
                et création d'un client sans quitter l'intervention. */}
            <ClientPicker
              clients={clients}
              value={clientId}
              onChange={(v) => setValue("client_id", v, { shouldValidate: true })}
              error={errors.client_id?.message}
            />
            {!clientId && (
              <p className="text-xs text-orange-700 dark:text-orange-300">
                Client à renseigner (facultatif pour l&apos;instant, indispensable pour facturer).
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
          <div className="md:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={watch("a_facturer") === false}
                onChange={(ev) => setValue("a_facturer", !ev.target.checked)}
              />
              <span>
                Rien à facturer
                <span className="ml-1 text-xs text-muted-foreground">
                  (déplacement, outils, perso… : exclue des compteurs « à facturer »)
                </span>
              </span>
            </label>
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
            {dureeDeduite !== null && !rempli(dureeSaisie) && (
              <p className="text-xs text-muted-foreground">
                D&apos;après les heures : <strong>{formatDuree(dureeDeduite)}</strong>, repris à
                l&apos;enregistrement si vous ne saisissez rien.
              </p>
            )}
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
          {equipements.length > 0 && (
            <div className="md:col-span-2">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Matériel connu chez ce client — un tap pour le reprendre
              </p>
              <div className="flex flex-wrap gap-2">
                {equipements.slice(0, 6).map((e) => (
                  <Button
                    key={e.cle}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal py-1.5 text-left"
                    onClick={() => reprendreEquipement(e)}
                  >
                    <Wrench className="size-3.5 shrink-0" />
                    <span>
                      {[e.marque, e.modele].filter(Boolean).join(" ") || "Matériel"}
                      {e.numSerie && (
                        <span className="text-muted-foreground"> · {e.numSerie}</span>
                      )}
                      {e.nbInterventions > 1 && (
                        <span className="text-muted-foreground"> · {e.nbInterventions} passages</span>
                      )}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}
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
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Manipulation de fluide (F-Gas)</CardTitle>
              <CardDescription>
                {fluideOuvert
                  ? "Traçabilité réglementaire : quantités manipulées, charge de l'équipement (→ éq. CO2) et contrôle d'étanchéité. Ces données pré-remplissent le CERFA 15497."
                  : "Clim / PAC uniquement. Rien à remplir pour la plomberie ou le chauffage."}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={fluideOuvert}
              aria-controls="bloc-fluide"
              onClick={() => setFluideOuvert((o) => !o)}
            >
              {fluideOuvert ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              {fluideOuvert ? "Replier" : "Renseigner"}
            </Button>
          </div>
        </CardHeader>
        {fluideOuvert && (
        <CardContent id="bloc-fluide" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fluide_type">Type de fluide</Label>
              <Input
                id="fluide_type"
                placeholder="R32, R410A, R454B, R290…"
                {...register("fluide_frigo_type")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="charge_totale">
                Charge totale de l&apos;équipement (kg)
              </Label>
              <Input
                id="charge_totale"
                type="number"
                step="0.001"
                min="0"
                inputMode="decimal"
                placeholder="2.400"
                {...register("fluide_charge_totale_kg")}
              />
              {(() => {
                const fluide = watch("fluide_frigo_type") as string;
                const chargeRaw = watch("fluide_charge_totale_kg");
                const charge =
                  chargeRaw === null || chargeRaw === undefined || chargeRaw === ""
                    ? null
                    : Number(chargeRaw);
                const prg = prgFluide(fluide);
                const teq = equivalentCo2Tonnes(fluide, charge);
                const periodicite = periodiciteControleMois(fluide, charge);
                if (prg === null) {
                  return fluide?.trim() ? (
                    <p className="text-xs text-muted-foreground">
                      Fluide inconnu de la table PRG — éq. CO2 non calculé.
                    </p>
                  ) : null;
                }
                return (
                  <p className="text-xs text-muted-foreground">
                    PRG {prg}
                    {teq !== null && (
                      <>
                        {" "}
                        · <strong>{formatEquivalentCo2(teq)}</strong>
                      </>
                    )}
                    {periodicite !== null && (
                      <> · contrôle d&apos;étanchéité tous les {periodicite} mois</>
                    )}
                  </p>
                );
              })()}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kg_ajoute">Kg ajoutés (chargés)</Label>
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
          </div>

          {/* Contrôle d'étanchéité (cadres 5 et 10 du CERFA 15497) */}
          <div className="rounded-md border bg-muted/20 p-4">
            <p className="mb-3 text-sm font-medium">Contrôle d&apos;étanchéité</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Contrôle effectué</Label>
                <Select
                  value={
                    watch("etancheite_controle") === true
                      ? "oui"
                      : watch("etancheite_controle") === false
                        ? "non"
                        : "nr"
                  }
                  onValueChange={(v) =>
                    setValue(
                      "etancheite_controle",
                      v === "oui" ? true : v === "non" ? false : null,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nr">Non renseigné</SelectItem>
                    <SelectItem value="oui">Oui</SelectItem>
                    <SelectItem value="non">Non</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {watch("etancheite_controle") === true && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="detecteur">
                      Détecteur utilisé (n° de série / repère)
                    </Label>
                    <Input
                      id="detecteur"
                      placeholder="Ex : Inficon D-TEK — SN 12345"
                      {...register("etancheite_detecteur")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="detecteur_controle">
                      Dernier contrôle du détecteur
                    </Label>
                    <Input
                      id="detecteur_controle"
                      type="date"
                      {...register("etancheite_detecteur_controle_le")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Vérification annuelle obligatoire (seuil ≤ 5 g/an).
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fuite constatée</Label>
                    <Select
                      value={
                        watch("etancheite_fuite") === true
                          ? "oui"
                          : watch("etancheite_fuite") === false
                            ? "non"
                            : "nr"
                      }
                      onValueChange={(v) =>
                        setValue(
                          "etancheite_fuite",
                          v === "oui" ? true : v === "non" ? false : null,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nr">Non renseigné</SelectItem>
                        <SelectItem value="non">Non — conforme</SelectItem>
                        <SelectItem value="oui">Oui — fuite détectée</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {watch("etancheite_fuite") === true && (
                    <div className="space-y-1.5">
                      <Label htmlFor="fuite_loc">
                        Localisation de la fuite / réparation
                      </Label>
                      <Input
                        id="fuite_loc"
                        placeholder="Ex : raccord flare UI, réparé et re-testé"
                        {...register("etancheite_fuite_localisation")}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fluide_obs">Observations</Label>
            <Textarea
              id="fluide_obs"
              rows={2}
              placeholder="Remarques sur la manipulation (reprises sur le CERFA)"
              {...register("fluide_observations")}
            />
          </div>
        </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes (interne)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea id="notes" aria-label="Notes internes" rows={3} {...register("notes")} />
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
