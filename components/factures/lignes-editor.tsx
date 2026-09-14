"use client";

import { useEffect, useState } from "react";
import {
  BookmarkPlus,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
  type FieldErrors,
  type FieldValues,
  type Path,
  type PathValue,
  type ArrayPath,
  type FieldArray,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEuros, parseMoneyInput } from "@/lib/format";
import { margeLigne, totauxMarges } from "@/lib/marges";
import { ecrireAfficherCouts, lireAfficherCouts } from "@/lib/afficher-couts";
import { contientMateriel } from "@/lib/sections";
import {
  ligneAbsenteDuCatalogue,
  ligneDepuisPrestation,
  type PrestationCatalogue,
} from "@/lib/catalogue-recherche";
import { ajouterLigneAuCatalogueAction } from "@/lib/actions/produits";
import { DesignationAutocomplete } from "@/components/factures/designation-autocomplete";
import type { Database } from "@/types/database";


/** Convertit une valeur de champ (string tolérant FR/EN) en number sûr. */
function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseMoneyInput(v);
  return Number.isFinite(n) ? n : 0;
}

type Produit = Database["public"]["Tables"]["produits_services"]["Row"];

type LigneShape = {
  id?: string;
  designation: string;
  quantite: number | string;
  prix_unitaire_ht: number | string;
  prix_achat_ttc_unitaire?: number | string | null;
  fournisseur?: string;
  nature_fiscale?: string;
  /** 'ligne' (défaut) ou 'titre' — titre de section, sans qté ni prix */
  type?: string;
};

/** Libellés courts pour le select de nature (case URSSAF) par ligne. */
const NATURES_LIGNE = [
  { value: "bic_prestations", label: "Prestation" },
  { value: "bic_ventes", label: "Vente seule" },
  { value: "bnc", label: "BNC" },
] as const;

/**
 * Éditeur générique de lignes pour facture ou devis (même structure).
 * Accepte n'importe quel form schema dont le champ `lignes` est un tableau
 * compatible avec `LigneShape`.
 */
export function LignesEditor<T extends FieldValues>({
  control,
  register,
  watch,
  setValue,
  errors,
  produits,
  fieldName = "lignes" as Path<T>,
  assujettiTva = false,
}: {
  control: Control<T>;
  register: UseFormRegister<T>;
  watch: UseFormWatch<T>;
  /** Requis par l'auto-complétion : une suggestion remplit plusieurs champs. */
  setValue: UseFormSetValue<T>;
  errors: FieldErrors<T>;
  produits: Produit[];
  fieldName?: Path<T>;
  assujettiTva?: boolean;
}) {
  const { fields, append, remove } = useFieldArray<T>({
    control,
    name: fieldName as ArrayPath<T>,
  });

  // Catalogue enrichi en cours de saisie : une prestation ajoutée
  // depuis une ligne devient immédiatement proposable sur les lignes
  // suivantes, sans recharger la page.
  const [ajoutees, setAjoutees] = useState<Produit[]>([]);
  const catalogue = [...produits, ...ajoutees] as PrestationCatalogue[];
  const [ajoutEnCours, setAjoutEnCours] = useState<number | null>(null);

  /** Écrit un champ de la ligne `index` en déclenchant la validation. */
  function ecrireChamp(index: number, champ: string, valeur: unknown) {
    setValue(
      `${fieldName}.${index}.${champ}` as Path<T>,
      valeur as PathValue<T, Path<T>>,
      { shouldValidate: true, shouldDirty: true },
    );
  }

  /**
   * Choix d'une suggestion : la ligne prend la désignation, le prix et
   * les coûts du catalogue. La QUANTITÉ n'est pas touchée — elle
   * appartient au chantier, pas à la prestation.
   */
  function appliquerPrestation(index: number, prestation: PrestationCatalogue) {
    const v = ligneDepuisPrestation(prestation);
    ecrireChamp(index, "designation", v.designation);
    ecrireChamp(index, "prix_unitaire_ht", v.prix_unitaire_ht);
    ecrireChamp(index, "prix_achat_ttc_unitaire", v.prix_achat_ttc_unitaire);
    ecrireChamp(index, "fournisseur", v.fournisseur);
    ecrireChamp(index, "nature_fiscale", v.nature_fiscale);
  }

  /**
   * Enregistre la ligne au catalogue. Le document en cours n'est pas
   * modifié : seule la bibliothèque de prestations s'enrichit.
   */
  async function ajouterAuCatalogue(index: number) {
    const l = lignes[index];
    if (!l) return;
    setAjoutEnCours(index);
    const res = await ajouterLigneAuCatalogueAction({
      designation: l.designation,
      prix_unitaire_ht: l.prix_unitaire_ht,
      prix_achat_ttc_unitaire: l.prix_achat_ttc_unitaire ?? null,
      fournisseur: l.fournisseur ?? "",
      nature_fiscale: l.nature_fiscale ?? "bic_prestations",
    });
    setAjoutEnCours(null);

    if (!res.ok) {
      toast.error("Ajout au catalogue impossible", { description: res.error });
      return;
    }
    // Ajoutée localement pour que la suggestion existe tout de suite
    // sur les lignes suivantes du même devis.
    setAjoutees((prev) => [
      ...prev,
      {
        id: res.data.id,
        designation: l.designation,
        description: null,
        prix_ht: toNum(l.prix_unitaire_ht),
        prix_achat_ttc:
          l.prix_achat_ttc_unitaire === null ||
          l.prix_achat_ttc_unitaire === undefined ||
          l.prix_achat_ttc_unitaire === ""
            ? null
            : toNum(l.prix_achat_ttc_unitaire),
        fournisseur: l.fournisseur || null,
        unite: "unité",
        categorie: "autre",
        nature_fiscale: l.nature_fiscale ?? "bic_prestations",
        actif: true,
      } as Produit,
    ]);
    toast.success(
      res.data.deja
        ? "Déjà dans votre catalogue"
        : "Ajoutée à votre catalogue",
      {
        description: res.data.deja
          ? undefined
          : "Elle vous sera proposée dès les prochains devis.",
      },
    );
  }

  // Cast pour pouvoir lire les valeurs typées sans s'embêter avec les Path<T>
  const lignes = (watch(fieldName) ?? []) as LigneShape[];

  // Toggle « Afficher mes coûts » : PRIVÉ, masqué par défaut, persisté
  // en localStorage. Ne pilote QUE l'affichage — les valeurs saisies
  // restent dans le formulaire même toggle éteint.
  const [afficherCouts, setAfficherCouts] = useState(false);
  useEffect(() => {
    setAfficherCouts(lireAfficherCouts());
  }, []);
  function basculerCouts() {
    setAfficherCouts((v) => {
      ecrireAfficherCouts(!v);
      return !v;
    });
  }

  const lignesPourMarges = lignes.map((l) => ({
    type: l.type,
    quantite: toNum(l.quantite),
    prix_unitaire_ht: toNum(l.prix_unitaire_ht),
    prix_achat_ttc_unitaire:
      l.prix_achat_ttc_unitaire === null ||
      l.prix_achat_ttc_unitaire === undefined ||
      l.prix_achat_ttc_unitaire === ""
        ? null
        : toNum(l.prix_achat_ttc_unitaire),
  }));
  const marges = totauxMarges(lignesPourMarges);

  function addEmptyLine() {
    append({
      designation: "",
      quantite: 1,
      prix_unitaire_ht: 0,
      prix_achat_ttc_unitaire: null,
      fournisseur: "",
      nature_fiscale: "bic_prestations",
      type: "ligne",
    } as unknown as FieldArray<T, ArrayPath<T>>);
  }

  // Titre de section (« MATÉRIEL », « MAIN-D'ŒUVRE »…) : pas de
  // quantité ni de prix — qté 1 × 0 € en interne pour satisfaire le
  // schéma, le PDF et les totaux l'ignorent.
  function addTitleLine() {
    append({
      designation: "",
      quantite: 1,
      prix_unitaire_ht: 0,
      prix_achat_ttc_unitaire: null,
      fournisseur: "",
      nature_fiscale: "bic_prestations",
      type: "titre",
    } as unknown as FieldArray<T, ArrayPath<T>>);
  }

  function addFromCatalog(produitId: string) {
    const p = catalogue.find((p) => p.id === produitId);
    if (!p) return;
    // Même helper que l'auto-complétion : une prestation ajoutée par
    // le sélecteur ou par le champ donne exactement la même ligne.
    append({
      ...ligneDepuisPrestation(p),
      quantite: 1,
      type: "ligne",
    } as unknown as FieldArray<T, ArrayPath<T>>);
  }

  const totalHt = lignes.reduce((sum, l) => {
    const q = toNum(l.quantite);
    const p = toNum(l.prix_unitaire_ht);
    return sum + q * p;
  }, 0);

  // Helper : récupère l'erreur d'une ligne donnée si elle existe
  const lignesErrorObj = errors[fieldName as keyof typeof errors] as
    | { message?: string; [k: string]: unknown }
    | undefined;
  function lineErr(index: number, key: "designation" | "quantite" | "prix_unitaire_ht") {
    const arr = lignesErrorObj as Array<Record<string, { message?: string }>> | undefined;
    return arr?.[index]?.[key]?.message;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={basculerCouts}
          className="text-muted-foreground"
        >
          {afficherCouts ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
          {afficherCouts ? "Masquer mes coûts" : "Afficher mes coûts"}
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          Aucune ligne. Ajoutez-en une depuis votre catalogue ou en saisie libre.
        </div>
      )}

      {fields.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          {/* En-têtes : uniquement >=sm. Sur mobile, chaque ligne porte
              ses propres mini-libellés (compact + lisible). */}
          <div className="hidden border-b bg-muted/30 px-3 py-2 sm:flex sm:items-center sm:gap-2 sm:text-xs sm:font-medium sm:uppercase sm:tracking-wide sm:text-muted-foreground">
            <div className="flex-1">Désignation</div>
            <div className="w-20 text-right">Qté</div>
            <div className="w-24 text-right">{assujettiTva ? "P.U. HT" : "P.U."}</div>
            <div className="w-24 text-right">Total</div>
            <div className="w-9" />
          </div>
          <div className="divide-y">
            {fields.map((field, index) => {
              const ligne = lignes[index];
              const lineTotal =
                toNum(ligne?.quantite) * toNum(ligne?.prix_unitaire_ht);
              const errDesignation = lineErr(index, "designation");
              const errQuantite = lineErr(index, "quantite");
              const errPrix = lineErr(index, "prix_unitaire_ht");

              // Titre de section : une seule saisie en gras, sans
              // quantité/prix/nature (valeurs neutres dans le form state)
              if (ligne?.type === "titre") {
                return (
                  <div
                    key={field.id}
                    className="flex items-start gap-2 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex-1 space-y-1">
                      <Input
                        placeholder="Titre de section (ex. MATÉRIEL, MAIN-D'ŒUVRE)"
                        className="border-dashed font-bold uppercase"
                        {...register(
                          `${fieldName}.${index}.designation` as Path<T>,
                        )}
                      />
                      {errDesignation && (
                        <p className="text-xs text-destructive">
                          {errDesignation}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      title="Supprimer le titre"
                      className="shrink-0"
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                );
              }

              const marge = margeLigne(lignesPourMarges[index]!);

              return (
                <div key={field.id}>
                <div className="space-y-2 px-3 py-3 sm:flex sm:items-start sm:gap-2 sm:space-y-0 sm:py-2">
                  {/* Désignation + nature URSSAF */}
                  <div className="space-y-1 sm:flex-1">
                    <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                      Ligne #{index + 1}
                    </span>
                    {/* Auto-complétion sur le catalogue : deux lettres
                        suffisent, les flèches choisissent, Entrée
                        remplit désignation + prix + coûts. La frappe
                        libre reste possible, rien n'est imposé. */}
                    <DesignationAutocomplete
                      value={(ligne?.designation as string) ?? ""}
                      catalogue={catalogue}
                      onChange={(v) => ecrireChamp(index, "designation", v)}
                      onSelectPrestation={(p) => appliquerPrestation(index, p)}
                    />
                    {errDesignation && (
                      <p className="text-xs text-destructive">{errDesignation}</p>
                    )}
                    {/* Alimentation du catalogue au fil de l'eau : le
                        bouton n'apparaît QUE sur une prestation qu'on
                        n'a pas encore, et disparaît une fois ajoutée. */}
                    {ligneAbsenteDuCatalogue(
                      { designation: ligne?.designation, type: ligne?.type },
                      catalogue,
                    ) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        disabled={ajoutEnCours === index}
                        onClick={() => ajouterAuCatalogue(index)}
                        title="Enregistrer cette prestation dans votre catalogue"
                      >
                        {ajoutEnCours === index ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <BookmarkPlus className="size-3.5" />
                        )}
                        Ajouter au catalogue
                      </Button>
                    )}
                    {/* Nature fiscale (case URSSAF) — select natif discret.
                        Défaut « Prestation » : ne changer que pour une
                        revente de matériel SANS pose. */}
                    <select
                      className="h-8 w-full max-w-44 rounded-md border border-input bg-transparent px-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Nature URSSAF de la ligne"
                      {...register(
                        `${fieldName}.${index}.nature_fiscale` as Path<T>,
                      )}
                    >
                      {NATURES_LIGNE.map((n) => (
                        <option key={n.value} value={n.value}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantité + Prix : côte à côte sur mobile, inline desktop */}
                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <div className="space-y-1 sm:w-20">
                      <span className="block text-[11px] text-muted-foreground sm:hidden">
                        Quantité
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="1"
                        className="text-right"
                        {...register(`${fieldName}.${index}.quantite` as Path<T>)}
                      />
                      {errQuantite && (
                        <p className="text-xs text-destructive">{errQuantite}</p>
                      )}
                    </div>
                    <div className="space-y-1 sm:w-24">
                      <span className="block text-[11px] text-muted-foreground sm:hidden">
                        {assujettiTva ? "P.U. HT (€)" : "P.U. (€)"}
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0,00"
                        className="text-right"
                        {...register(
                          `${fieldName}.${index}.prix_unitaire_ht` as Path<T>,
                        )}
                      />
                      {errPrix && (
                        <p className="text-xs text-destructive">{errPrix}</p>
                      )}
                    </div>
                  </div>

                  {/* Total ligne + bouton supprimer */}
                  <div className="flex items-center justify-between gap-2 border-t pt-2 sm:w-auto sm:border-t-0 sm:pt-0 sm:contents">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground sm:hidden">
                      Total
                    </span>
                    <div className="flex items-center gap-1 sm:contents">
                      <span className="text-sm font-medium tabular-nums sm:w-24 sm:pt-2 sm:text-right">
                        {formatEuros(lineTotal, { withSymbol: false })} €
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        title="Supprimer la ligne"
                        className="sm:w-9 sm:shrink-0"
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Volet PRIVÉ (toggle « Afficher mes coûts ») : prix
                    d'achat TTC + fournisseur + marge — jamais rendu au
                    client (liste blanche PDF, RLS owner-only). */}
                {afficherCouts && (
                  <div className="flex flex-wrap items-end gap-2 border-t border-dashed border-amber-300/60 bg-amber-500/5 px-3 py-2 dark:border-amber-800/60">
                    <div className="space-y-0.5">
                      <span className="block text-[11px] text-muted-foreground">
                        Prix d'achat TTC (coût réel)
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="—"
                        className="h-8 w-28 text-right"
                        {...register(
                          `${fieldName}.${index}.prix_achat_ttc_unitaire` as Path<T>,
                        )}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <span className="block text-[11px] text-muted-foreground">
                        Fournisseur
                      </span>
                      <Input
                        type="text"
                        autoComplete="off"
                        placeholder="ex. Yukai, Artiplastic"
                        className="h-8 w-40"
                        {...register(
                          `${fieldName}.${index}.fournisseur` as Path<T>,
                        )}
                      />
                    </div>
                    <div className="ml-auto pb-1 text-right text-xs tabular-nums">
                      {marge.margeEuros === null ? (
                        <span className="text-muted-foreground">
                          marge : saisir un PA
                        </span>
                      ) : (
                        <span
                          className={
                            marge.margeEuros < 0
                              ? "font-medium text-destructive"
                              : "font-medium text-green-700 dark:text-green-400"
                          }
                        >
                          marge {formatEuros(marge.margeEuros)}
                          {marge.margePct !== null
                            ? ` (${marge.margePct.toLocaleString("fr-FR")} %)`
                            : ""}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-4 border-t bg-muted/30 px-4 py-3 sm:justify-end">
            <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {assujettiTva ? "Total HT" : "Total"}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {formatEuros(totalHt)}
            </span>
          </div>

          {/* Totaux PRIVÉS de marge (toggle actif uniquement) */}
          {afficherCouts && (
            <div className="space-y-1 border-t border-dashed border-amber-300/60 bg-amber-500/5 px-4 py-3 text-sm dark:border-amber-800/60">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Coût d'achat total (TTC)
                </span>
                <span className="tabular-nums">
                  {formatEuros(marges.coutTotal)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Marge totale</span>
                <span
                  className={
                    marges.margeTotale < 0
                      ? "font-semibold tabular-nums text-destructive"
                      : "font-semibold tabular-nums text-green-700 dark:text-green-400"
                  }
                >
                  {formatEuros(marges.margeTotale)}
                  {marges.tauxMargePct !== null
                    ? ` (${marges.tauxMargePct.toLocaleString("fr-FR")} %)`
                    : ""}
                </span>
              </div>
              {marges.nbLignesSansPa > 0 && (
                <p className="text-xs text-muted-foreground">
                  {marges.nbLignesSansPa} ligne(s) sans prix d'achat — exclue(s)
                  de la marge.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {typeof lignesErrorObj?.message === "string" && (
        <p className="text-sm text-destructive">{lignesErrorObj.message}</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="outline" onClick={addEmptyLine}>
          <Plus className="size-4" />
          Ajouter une ligne libre
        </Button>

        <Button type="button" variant="outline" onClick={addTitleLine}>
          <Plus className="size-4" />
          Titre de section
        </Button>

        {catalogue.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">
              Ou depuis le catalogue
            </Label>
            <Select onValueChange={addFromCatalog} value="">
              <SelectTrigger className="w-[320px]">
                <SelectValue placeholder="Choisir une prestation…" />
              </SelectTrigger>
              <SelectContent>
                {catalogue.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex w-full justify-between gap-3">
                      <span>{p.designation}</span>
                      <span className="text-muted-foreground">
                        {formatEuros(Number(p.prix_ht))} / {p.unite}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        💡 La quantité se saisit dans la colonne Qté — inutile de la
        répéter dans la désignation (« 2x … »). Les titres de section
        s'affichent en gras sur le PDF avec un sous-total par section.
      </p>

      {/* Info activité mixte — formulaire uniquement, jamais sur le PDF */}
      {contientMateriel(lignes) && (
        <div className="rounded-md border border-sky-600/30 bg-sky-500/5 p-3 text-xs text-muted-foreground">
          ℹ️ Ce document contient du matériel. En micro-entreprise, les
          cotisations s'appliquent sur le TOTAL encaissé, matériel
          compris (pas de déduction d'achats), et la fourniture de
          matériel revendu sans pose relève de l'activité mixte
          (case « ventes » de la déclaration URSSAF — la nature de
          chaque ligne fait déjà la ventilation). Information
          indicative, rien à faire de plus.
        </div>
      )}
    </div>
  );
}
