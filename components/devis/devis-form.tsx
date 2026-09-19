"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronRight, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  devisSchema,
  type DevisFormInput,
  type DevisFormValues,
} from "@/lib/validations/devis";
import { isClimPac, type TypeActivite } from "@/lib/validations/facture";
import { dateValiditeDevis, dureeValiditeSure } from "@/lib/devis-validite";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";
import { ligneAcompte } from "@/lib/devis-modele";
import { parseMoneyInput } from "@/lib/format";
import { prixEffectif, quantiteEffective } from "@/lib/lignes-saisie";
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
import { ClientPicker } from "@/components/clients/client-picker";

import type { Database } from "@/types/database";
import type { NatureFiscale } from "@/lib/fiscal";
import type { BaremeEntretien } from "@/lib/bareme-entretien";

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
  dureeValiditeJours,
  prefill,
  assujettiTva = false,
  baremeEntretien = null,
}: {
  clients: Client[];
  produits: Produit[];
  devis?: Devis;
  lignes?: Ligne[];
  defaultConditions?: string | null;
  /** Réglage duree_validite_devis_jours (défaut 30) */
  dureeValiditeJours?: number | null;
  /** Libellés « HT » uniquement si le document est assujetti (snapshot). */
  assujettiTva?: boolean;
  /** Barème d'entretien pour « Calculer un entretien » (lignes auto). */
  baremeEntretien?: BaremeEntretien | null;
  prefill?: {
    devis: Partial<Devis>;
    lignes: Array<{
      designation: string;
      quantite: number;
      prix_unitaire_ht: number;
      nature_fiscale?: string;
      type?: string;
      prix_achat_ttc_unitaire?: number | null;
      fournisseur?: string;
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
        // Coûts privés repris à la duplication (sinon le formulaire les
        // perdait et la marge repartait de zéro).
        prix_achat_ttc_unitaire: l.prix_achat_ttc_unitaire ?? null,
        fournisseur: l.fournisseur ?? "",
        nature_fiscale: (l.nature_fiscale ?? "bic_prestations") as NatureFiscale,
        type: ((l as { type?: string }).type ?? "ligne") as "ligne" | "titre",
      }));

  const today = new Date().toISOString().slice(0, 10);
  // « Valable jusqu'au » pré-rempli depuis le réglage (défaut 30 j),
  // surchargeable librement dans le champ.
  const dureeValidite = dureeValiditeSure(dureeValiditeJours);
  const validiteInitiale = dateValiditeDevis(today, dureeValidite);

  const equip = (base?.equipement_info ?? {}) as Record<string, unknown>;
  const perfs = (base?.performances_energetiques ?? {}) as Record<string, unknown>;
  const aides = (base?.aides_financieres ?? {}) as Record<string, unknown>;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, dirtyFields },
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
      date_validite: base?.date_validite ?? validiteInitiale,
      date_debut_travaux: base?.date_debut_travaux ?? "",
      duree_estimee_jours: base?.duree_estimee_jours ?? null,
      acompte_pct: base?.acompte_pct ?? null,
      acompte_montant: base?.acompte_montant ?? null,
      signe_a_domicile: base?.signe_a_domicile ?? false,
      mode_conclusion:
        ((base as { mode_conclusion?: string } | undefined)?.mode_conclusion as
          | "etablissement"
          | "hors_etablissement"
          | "distance"
          | undefined) ?? (base?.signe_a_domicile ? "hors_etablissement" : "etablissement"),
      adresse_chantier: (base as { adresse_chantier?: string | null } | undefined)?.adresse_chantier ?? "",
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

  // En création, « Valable jusqu'au » suit la date d'émission tant que
  // l'utilisateur n'a pas touché le champ lui-même (surcharge libre).
  const dateEmissionSaisie = watch("date_emission");
  useEffect(() => {
    if (isEdit || dirtyFields.date_validite || !dateEmissionSaisie) return;
    setValue("date_validite", dateValiditeDevis(dateEmissionSaisie, dureeValidite));
  }, [dateEmissionSaisie, isEdit, dirtyFields.date_validite, dureeValidite, setValue]);

  const currentType = watch("type_activite") as TypeActivite;
  const showEquipement = isClimPac(currentType);
  const showPerformances = isClimPac(currentType);

  // Les détails techniques s'ouvrent d'emblée si le devis en porte
  // déjà (édition, duplication, modèle) : replier des champs remplis
  // les rendrait invisibles sans les supprimer, ce qui est pire que
  // de les afficher. Calculé une fois, à l'ouverture du formulaire.
  const [detailsRemplis] = useState(() =>
    [equip, perfs, aides].some((o) =>
      Object.values(o).some((v) => v !== null && v !== undefined && v !== ""),
    ),
  );

  // Total et acompte en direct. Les lignes de type « titre » ne portent
  // pas de montant : on les exclut, comme le fait le PDF.
  const lignesSaisies = watch("lignes") ?? [];
  const totalHtSaisi = lignesSaisies.reduce((somme, l) => {
    if ((l as { type?: string })?.type === "titre") return somme;
    // Même lecture que l'éditeur de lignes : quantité vide = 1, prix
    // vide = 0 (lib/lignes-saisie).
    return (
      somme +
      quantiteEffective(l?.quantite) * prixEffectif(l?.prix_unitaire_ht)
    );
  }, 0);

  const acomptePctSaisi = watch("acompte_pct");
  const acompteMontantSaisi = watch("acompte_montant");
  const nombreOuNull = (v: unknown) => {
    if (v === null || v === undefined || v === "") return null;
    const n = parseMoneyInput(String(v));
    return Number.isFinite(n) ? n : null;
  };
  // Même fonction que celle du PDF : l'aperçu ne peut pas diverger du
  // document imprimé.
  const ligneAcompteApercu = ligneAcompte(
    totalHtSaisi,
    nombreOuNull(acomptePctSaisi),
    nombreOuNull(acompteMontantSaisi),
  );

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

  // Validation refusée : sur le téléphone, l'erreur sous un champ hors
  // écran est invisible — on prévient et on y amène.
  function onInvalid(errs: Record<string, unknown>) {
    const premier = Object.keys(errs)[0];
    const labels: Record<string, string> = {
      client_id: "le client",
      type_activite: "le type d'activité",
      lignes: "les lignes",
      date_emission: "la date d'émission",
      date_validite: "la date de validité",
    };
    toast.error("Devis incomplet", {
      description: premier
        ? `Vérifiez ${labels[premier] ?? `le champ « ${premier} »`}.`
        : "Vérifiez les champs signalés.",
    });
    document
      .querySelector<HTMLElement>("[aria-invalid='true'], .text-destructive")
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      {/* Client d'abord : un devis commence par « pour qui ».
          Recherche instantanée, et création en dialogue pour ne pas
          casser le fil quand c'est un nouveau client. */}
      <Card>
        <CardHeader>
          <CardTitle>Client et dates</CardTitle>
          <CardDescription>
            {isEdit
              ? "Modifiez les dates si besoin."
              : `Validité par défaut : ${dureeValidite} jours (réglable dans Paramètres, modifiable ici).`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="client_id">Client *</Label>
            <ClientPicker
              clients={clients}
              value={watch("client_id")}
              onChange={(v) =>
                setValue("client_id", v, { shouldValidate: true })
              }
              error={errors.client_id?.message}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="type_activite">Type d'activité *</Label>
            <Select
              value={currentType}
              onValueChange={(v) =>
                setValue("type_activite", v as DevisFormInput["type_activite"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="type_activite" className="md:max-w-md">
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
              <p className="text-xs text-destructive">
                {errors.type_activite.message}
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
          <div className="space-y-1.5">
            <Label htmlFor="acompte_pct">Acompte demandé (%)</Label>
            <Input
              id="acompte_pct"
              type="text"
              inputMode="decimal"
              placeholder="Ex : 30"
              {...register("acompte_pct")}
            />
            {errors.acompte_pct && (
              <p className="text-xs text-destructive">
                {errors.acompte_pct.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acompte_montant">ou montant fixe (€)</Label>
            <Input
              id="acompte_montant"
              type="text"
              inputMode="decimal"
              placeholder="Ex : 500"
              {...register("acompte_montant")}
            />
            <p className="text-xs text-muted-foreground">
              Le % prime si les deux sont remplis.
            </p>
          </div>
          {/* Acompte recalculé pendant la saisie, à partir du total des
              lignes : plus besoin de sortir la calculatrice pour
              vérifier ce que le client va devoir verser. Exactement la
              phrase qu'imprimera le PDF. */}
          <div className="md:col-span-2">
            {ligneAcompteApercu ? (
              <p className="rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2 text-sm">
                {ligneAcompteApercu}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {totalHtSaisi > 0
                  ? "Aucun acompte : le PDF n'affichera pas de ligne d'acompte."
                  : "Le montant s'affichera ici dès que les prestations seront saisies."}
              </p>
            )}
          </div>
          <fieldset className="space-y-2 md:col-span-2">
            <legend className="text-sm font-medium">Comment ce devis sera-t-il accepté ?</legend>
            <p className="text-xs text-muted-foreground">
              Chez le client ou à distance (email, lien, téléphone), un
              particulier dispose d&apos;un droit de rétractation de 14 jours
              (art. L221-18) : le PDF ajoute alors la mention et le formulaire
              — sans eux, le délai passe à 12 mois.
            </p>
            {(
              [
                ["etablissement", "Signé dans mon local (pas de rétractation)"],
                ["hors_etablissement", "Signé chez le client (hors établissement)"],
                ["distance", "Accepté à distance (email, lien, téléphone)"],
              ] as const
            ).map(([valeur, libelle]) => (
              <label key={valeur} className="flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
                <input
                  type="radio"
                  value={valeur}
                  className="size-4 accent-primary"
                  {...register("mode_conclusion")}
                />
                {libelle}
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="adresse_chantier">Adresse du chantier (si différente du client)</Label>
            <Input
              id="adresse_chantier"
              placeholder="Ex : 12 rue des Alpes, 38000 Grenoble"
              autoComplete="off"
              {...register("adresse_chantier")}
            />
          </div>
          {/* Colonne historique, dérivée du mode côté serveur ; le champ
              reste enregistré pour ne pas casser le schéma du formulaire. */}
          <input type="hidden" {...register("signe_a_domicile")} />
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
            setValue={setValue}
            errors={errors}
            produits={produits}
            assujettiTva={assujettiTva}
            baremeEntretien={baremeEntretien}
          />
        </CardContent>
      </Card>

      {/* Détails techniques : utiles pour un dossier clim/PAC ou
          MaPrimeRénov', encombrants pour un dépannage. Repliés par
          défaut, dépliables d'un clic, et le contenu reste MONTÉ —
          un champ déjà rempli (duplication, modèle, édition) ne
          disparaît donc pas du formulaire quand le bloc est fermé. */}
      <details className="group rounded-lg border bg-card" open={detailsRemplis}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-6 py-4 font-semibold">
          <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
          Détails techniques (optionnel)
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {showEquipement
              ? "équipement, performances, aides financières"
              : "aides financières"}
          </span>
        </summary>
        <div className="space-y-6 border-t p-6 pt-4">
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
        </div>
      </details>

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
