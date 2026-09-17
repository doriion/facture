"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Repeat, Save, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import type { ChangementOptimiste } from "@/lib/agenda-optimiste";

import {
  createInterventionAction,
  createInterventionSerieAction,
  quickEditInterventionAction,
  deleteInterventionAction,
} from "@/lib/actions/interventions";
import {
  CHOIX_REPETITION,
  LABELS_REPETITION,
  MAX_OCCURRENCES,
  datesOccurrences,
  depassePlafond,
  finParDefaut,
  libelleRecurrence,
  regleDuChoix,
  type ChoixRepetition,
  type PorteeSerie,
  type Recurrence,
} from "@/lib/agenda-recurrence";
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

/** Valeur du menu déroulant pour « aucun client » (Radix refuse la chaîne vide). */
const SANS_CLIENT = "__sans_client__";

/**
 * Données minimales d'une intervention pour pré-remplir le dialogue
 * en mode édition. Couvre tous les champs gérés par ce dialogue rapide.
 */
export type InterventionEditData = {
  id: string;
  /** null = client à renseigner */
  client_id: string | null;
  date_intervention: string;
  date_fin: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  type: string;
  description: string | null;
  /** false = rien à facturer */
  a_facturer: boolean;
  /** Série de rendez-vous récurrents (null = isolé). */
  serie_id?: string | null;
  recurrence?: Recurrence | null;
};

/** Heures pré-remplies (HH:MM) quand on clique un créneau de la grille horaire. */
export type CreneauPrerempli = { heure_debut: string; heure_fin: string };

export function QuickInterventionDialog({
  open,
  onOpenChange,
  date,
  creneau = null,
  clients,
  editIntervention,
  onOptimiste,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** YYYY-MM-DD — date pré-remplie en mode création */
  date: string;
  /** Heures pré-remplies en mode création (clic sur la grille jour / semaine) ; null = journée */
  creneau?: CreneauPrerempli | null;
  clients: ClientOption[];
  /** Si présent : mode édition (mise à jour de cette intervention) */
  editIntervention?: InterventionEditData;
  /**
   * Mise à jour optimiste : appelé AVANT l'enregistrement pour afficher
   * le résultat tout de suite ; renvoie la fonction qui annule si le
   * serveur refuse.
   */
  onOptimiste?: (changement: ChangementOptimiste) => () => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isEdit = Boolean(editIntervention);
  // Création : répétition (jamais / semaines / quinzaine / mois / ans)
  // et date de fin de la série. Édition d'une occurrence : portée des
  // changements (ce rendez-vous seul, ou lui et les suivants).
  const [repetition, setRepetition] = useState<ChoixRepetition>("jamais");
  const [finRepetition, setFinRepetition] = useState("");
  const [portee, setPortee] = useState<PorteeSerie>("seule");
  const enSerie = Boolean(editIntervention?.serie_id);

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
      : makeDefaults(date, creneau),
  });

  // Réinitialise quand on change de date ou de créneau, qu'on rouvre la
  // modale (création), ou quand on change d'intervention cible (édition).
  const heureDebutPreremplie = creneau?.heure_debut ?? "";
  const heureFinPreremplie = creneau?.heure_fin ?? "";
  useEffect(() => {
    if (!open) return;
    reset(
      editIntervention
        ? makeDefaultsFromIntervention(editIntervention)
        : makeDefaults(
            date,
            heureDebutPreremplie
              ? { heure_debut: heureDebutPreremplie, heure_fin: heureFinPreremplie }
              : null,
          ),
    );
    setRepetition("jamais");
    setFinRepetition("");
    setPortee("seule");
  }, [open, date, heureDebutPreremplie, heureFinPreremplie, editIntervention, reset]);

  // Clients créés depuis ce dialogue (« + Nouveau client ») : ajoutés à
  // la liste tout de suite, sans attendre le rafraîchissement serveur.
  const [clientsCrees, setClientsCrees] = useState<ClientOption[]>([]);
  const tousLesClients = [
    ...clients,
    ...clientsCrees.filter((n) => !clients.some((c) => c.id === n.id)),
  ];

  const currentClient = watch("client_id") ?? "";
  const currentType = watch("type");
  const currentStart = watch("date_intervention");
  const currentEnd = watch("date_fin");
  const dureeJours = computeDureeJours(currentStart, currentEnd);

  // Règle de répétition choisie (création) et ses occurrences.
  const regle = regleDuChoix(repetition);
  const recurrence: Recurrence | null =
    regle && currentStart
      ? { ...regle, date_fin: finRepetition || finParDefaut(currentStart, regle.frequence) }
      : null;
  const tropDOccurrences = Boolean(
    recurrence && currentStart && depassePlafond(currentStart, recurrence),
  );
  const nbOccurrences =
    recurrence && currentStart && !tropDOccurrences
      ? datesOccurrences(currentStart, recurrence).length
      : 0;
  const choisirRepetition = (choix: ChoixRepetition) => {
    setRepetition(choix);
    const r = regleDuChoix(choix);
    setFinRepetition(r && currentStart ? finParDefaut(currentStart, r.frequence) : "");
  };

  async function onSubmit(values: InterventionFormValues) {
    if (recurrence && recurrence.date_fin < values.date_intervention) {
      toast.error("La fin de la répétition précède le premier rendez-vous.");
      return;
    }
    if (tropDOccurrences) {
      toast.error(`Trop de rendez-vous (plus de ${MAX_OCCURRENCES}) : rapprochez la date de fin.`);
      return;
    }
    setSubmitting(true);
    // Affichage immédiat : le dialogue se ferme, le rendez-vous est déjà
    // dans l'agenda ; le serveur confirme derrière (ou on annule).
    const id = editIntervention?.id ?? `tmp-${Date.now()}`;
    const clientNom =
      tousLesClients.find((c) => c.id === (values.client_id || ""))?.nom ?? null;
    const surLesSuivantes = enSerie && portee === "suivantes";
    const annuler = onOptimiste?.(
      editIntervention
        ? surLesSuivantes
          ? {
              type: "edition_suivantes",
              id: editIntervention.id,
              serie_id: editIntervention.serie_id!,
              depuis: editIntervention.date_intervention,
              valeurs: values,
              clientNom,
            }
          : { type: "edition", id, valeurs: values, clientNom }
        : recurrence
          ? {
              type: "creation_serie",
              prefixe: id,
              dates: datesOccurrences(values.date_intervention, recurrence),
              valeurs: values,
              clientNom,
              recurrence,
            }
          : { type: "creation", id, valeurs: values, clientNom },
    );
    onOpenChange(false);

    const result = editIntervention
      ? await quickEditInterventionAction(
          editIntervention.id,
          {
            client_id: values.client_id || null,
            date_intervention: values.date_intervention,
            date_fin: values.date_fin || null,
            heure_debut: values.heure_debut || null,
            heure_fin: values.heure_fin || null,
            type: values.type,
            description: values.description || null,
            a_facturer: values.a_facturer ?? true,
          },
          surLesSuivantes ? "suivantes" : "seule",
        )
      : recurrence
        ? await createInterventionSerieAction(values, recurrence)
        : await createInterventionAction(values);
    setSubmitting(false);

    if (result.ok) {
      toast.success(
        isEdit
          ? surLesSuivantes
            ? "Série modifiée à partir de ce rendez-vous"
            : "Intervention modifiée"
          : recurrence
            ? `${nbOccurrences} rendez-vous planifiés`
            : "Intervention planifiée",
      );
      router.refresh();
    } else {
      annuler?.();
      toast.error(isEdit ? "Modification refusée" : "Planification refusée", {
        description: result.error,
      });
    }
  }

  async function onDelete() {
    if (!editIntervention) return;
    setSubmitting(true);
    const surLesSuivantes = enSerie && portee === "suivantes";
    const annuler = onOptimiste?.(
      surLesSuivantes
        ? {
            type: "suppression_suivantes",
            serie_id: editIntervention.serie_id!,
            depuis: editIntervention.date_intervention,
          }
        : { type: "suppression", id: editIntervention.id },
    );
    onOpenChange(false);
    const result = await deleteInterventionAction(
      editIntervention.id,
      surLesSuivantes ? "suivantes" : "seule",
    );
    setSubmitting(false);
    if (result.ok) {
      const { supprimees, conservees } = result.data;
      toast.success(
        supprimees > 1 ? `${supprimees} rendez-vous supprimés` : "Intervention supprimée",
        conservees > 0
          ? { description: `${conservees} conservé(s) : signatures ou fiches CERFA à garder.` }
          : undefined,
      );
      router.refresh();
    } else {
      annuler?.();
      toast.error("Suppression refusée", { description: result.error });
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
          className="min-w-0 space-y-4"
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
            <Label htmlFor="client_id">Client (optionnel)</Label>
            <div className="flex flex-wrap gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  value={currentClient || SANS_CLIENT}
                  onValueChange={(v) =>
                    setValue("client_id", v === SANS_CLIENT ? "" : v, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="client_id">
                    <SelectValue placeholder="Client à renseigner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SANS_CLIENT}>
                      <span className="text-muted-foreground">
                        Aucun client pour l&apos;instant
                      </span>
                    </SelectItem>
                    {tousLesClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Création sans quitter l'agenda : le nouveau client est
                  sélectionné dès sa création. */}
              <ClientFormDialog
                onCreated={(nouvelId, client) => {
                  setClientsCrees((l) => [...l, { id: nouvelId, nom: client.nom }]);
                  setValue("client_id", nouvelId, { shouldValidate: true });
                }}
                trigger={
                  <Button type="button" variant="outline">
                    <Plus className="size-4" />
                    Nouveau client
                  </Button>
                }
              />
            </div>
            {!currentClient && (
              <p className="text-xs text-muted-foreground">
                Vous pourrez rattacher le client plus tard ; il sera demandé
                au moment de facturer.
              </p>
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

          {/* Création : répéter le rendez-vous (série) */}
          {!isEdit && (
            <div className="space-y-2 rounded-md border px-3 py-2">
              <div className="grid grid-cols-[3fr_2fr] gap-3">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="repetition">Répéter</Label>
                  <Select
                    value={repetition}
                    onValueChange={(v) => choisirRepetition(v as ChoixRepetition)}
                  >
                    <SelectTrigger id="repetition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHOIX_REPETITION.map((c) => (
                        <SelectItem key={c} value={c}>
                          {LABELS_REPETITION[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {recurrence && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fin_repetition">Jusqu&apos;au</Label>
                    <Input
                      id="fin_repetition"
                      type="date"
                      value={recurrence.date_fin}
                      min={currentStart || undefined}
                      onChange={(ev) => setFinRepetition(ev.target.value)}
                    />
                  </div>
                )}
              </div>
              {recurrence && (
                <p
                  className={
                    tropDOccurrences || recurrence.date_fin < currentStart
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {recurrence.date_fin < currentStart
                    ? "La fin de la répétition précède le premier rendez-vous."
                    : tropDOccurrences
                      ? `Plus de ${MAX_OCCURRENCES} rendez-vous : rapprochez la date de fin.`
                      : `${nbOccurrences} rendez-vous seront créés, ${libelleRecurrence(recurrence)}. Chacun se facture, se déplace ou se supprime séparément.`}
                </p>
              )}
            </div>
          )}

          {/* Édition d'une occurrence : portée des changements */}
          {isEdit && enSerie && (
            <div className="space-y-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <p className="flex items-center gap-2">
                <Repeat className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  Fait partie d&apos;une série
                  {editIntervention?.recurrence
                    ? ` : ${libelleRecurrence(editIntervention.recurrence)}`
                    : ""}
                  .
                </span>
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="portee"
                    className="accent-primary"
                    checked={portee === "seule"}
                    onChange={() => setPortee("seule")}
                  />
                  Ce rendez-vous seulement
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="portee"
                    className="accent-primary"
                    checked={portee === "suivantes"}
                    onChange={() => setPortee("suivantes")}
                  />
                  <span>
                    Ce rendez-vous et les suivants
                    <span className="ml-1 text-xs text-muted-foreground">
                      (les facturés ne bougent pas)
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Tout ce qui est sur le planning n'est pas à facturer */}
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
                (déplacement, outils, perso…)
              </span>
            </span>
          </label>
        </form>

        {/* min-w-0 + flex-wrap : en mode édition, les quatre boutons ne
            doivent pas élargir le dialogue (sinon le formulaire déborde). */}
        <DialogFooter className="min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
          {isEdit && editIntervention ? (
            <div className="flex flex-wrap items-center gap-2">
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
                      {enSerie && portee === "suivantes"
                        ? "Supprimer ce rendez-vous et les suivants ?"
                        : "Supprimer cette intervention ?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {enSerie && portee === "suivantes"
                        ? "Tous les rendez-vous de la série à partir de celui-ci seront supprimés, sauf ceux déjà facturés ou portant des documents à conserver. Cette action est irréversible."
                        : "Cette action est irréversible."}
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
              disabled={submitting}
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

function makeDefaults(
  date: string,
  creneau: CreneauPrerempli | null,
): InterventionFormInput {
  return {
    client_id: "",
    date_intervention: date,
    date_fin: "",
    heure_debut: creneau?.heure_debut ?? "",
    heure_fin: creneau?.heure_fin ?? "",
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
    a_facturer: true,
  };
}

function makeDefaultsFromIntervention(
  it: InterventionEditData,
): InterventionFormInput {
  // Postgres renvoie les TIME au format "HH:MM:SS" — un input[type=time]
  // accepte "HH:MM" ou "HH:MM:SS", on garde tel quel.
  return {
    client_id: it.client_id ?? "",
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
    a_facturer: it.a_facturer,
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
