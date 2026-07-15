"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileCheck2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteCerfaAction,
  genererCerfaAction,
  type CerfaDocument,
} from "@/lib/actions/cerfa";
import {
  NATURES_INTERVENTION,
  naturesParDefaut,
  type CerfaOptions,
  type NatureIntervention,
} from "@/lib/cerfa";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatDateFr } from "@/lib/format";
import type { Database } from "@/types/database";

type Intervention = Database["public"]["Tables"]["interventions"]["Row"];

function KgInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step="0.001"
        min="0"
        inputMode="decimal"
        className="h-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * Génération + archives de la fiche d'intervention fluides (trame
 * CERFA 15497*04). Le dialogue reprend les rubriques que l'app ne
 * stocke pas en colonnes (natures, ventilation A/B/C-D/E, système
 * permanent, déchets/BSFF) — le snapshot complet est archivé avec le
 * PDF.
 */
export function InterventionCerfa({
  intervention,
  documents,
  attestationManquante,
}: {
  intervention: Intervention;
  documents: CerfaDocument[];
  attestationManquante: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const [ficheNumero, setFicheNumero] = useState("");
  const [natures, setNatures] = useState<NatureIntervention[]>(() =>
    naturesParDefaut(intervention),
  );
  const [systemePermanent, setSystemePermanent] = useState(false);
  const [chargeVierge, setChargeVierge] = useState(
    intervention.fluide_frigo_kg_ajoute !== null
      ? String(intervention.fluide_frigo_kg_ajoute)
      : "",
  );
  const [chargeRecycle, setChargeRecycle] = useState("");
  const [chargeRegenere, setChargeRegenere] = useState("");
  const [recupTraitement, setRecupTraitement] = useState(
    intervention.fluide_frigo_kg_recupere !== null
      ? String(intervention.fluide_frigo_kg_recupere)
      : "",
  );
  const [recupReutilisation, setRecupReutilisation] = useState("");
  const [avecDechets, setAvecDechets] = useState(false);
  const [dechetsCodeUn, setDechetsCodeUn] = useState("");
  const [dechetsContenants, setDechetsContenants] = useState("");
  const [dechetsBsff, setDechetsBsff] = useState("");
  const [dechetsDestNom, setDechetsDestNom] = useState("");
  const [dechetsDestAdresse, setDechetsDestAdresse] = useState("");

  // Resynchronise à chaque ouverture les champs dérivés de
  // l'intervention : les useState ne s'initialisent qu'au premier
  // montage, or l'utilisateur peut modifier les kg / le contrôle
  // d'étanchéité puis générer la fiche sans recharger la page
  // (même pattern que quick-intervention-dialog).
  useEffect(() => {
    if (!open) return;
    setNatures(naturesParDefaut(intervention));
    setChargeVierge(
      intervention.fluide_frigo_kg_ajoute !== null
        ? String(intervention.fluide_frigo_kg_ajoute)
        : "",
    );
    setRecupTraitement(
      intervention.fluide_frigo_kg_recupere !== null
        ? String(intervention.fluide_frigo_kg_recupere)
        : "",
    );
  }, [open, intervention]);

  function toggleNature(nat: NatureIntervention) {
    setNatures((prev) =>
      prev.includes(nat) ? prev.filter((n) => n !== nat) : [...prev, nat],
    );
  }

  const kgOrNull = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  async function onGenerate() {
    setGenerating(true);
    const options: CerfaOptions = {
      ficheNumero,
      natures,
      systemePermanentDetection: systemePermanent,
      chargeViergeKg: kgOrNull(chargeVierge),
      chargeRecycleKg: kgOrNull(chargeRecycle),
      chargeRegenereKg: kgOrNull(chargeRegenere),
      recupereTraitementKg: kgOrNull(recupTraitement),
      recupereReutilisationKg: kgOrNull(recupReutilisation),
      dechets: avecDechets
        ? {
            codeUn: dechetsCodeUn,
            contenants: dechetsContenants,
            numeroBsff: dechetsBsff,
            destinationNom: dechetsDestNom,
            destinationAdresse: dechetsDestAdresse,
          }
        : null,
    };
    const res = await genererCerfaAction(intervention.id, options);
    setGenerating(false);
    if (res.ok) {
      toast.success("CERFA 15497 généré et archivé");
      setOpen(false);
      if (res.data.url) {
        window.open(res.data.url, "_blank", "noopener");
      }
      router.refresh();
    } else {
      toast.error("Erreur", { description: res.error });
    }
  }

  function onDelete(id: string) {
    setPendingDelete(id);
    deleteCerfaAction(id).then((res) => {
      setPendingDelete(null);
      if (res.ok) {
        toast.success("Archive supprimée");
        router.refresh();
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck2 className="size-4 text-primary" />
          CERFA 15497 — fiche d&apos;intervention fluides
          {documents.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({documents.length})
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Fiche pré-remplie (trame 15497*04) : opérateur, détenteur,
          équipement, éq. CO2, contrôle d&apos;étanchéité et signatures.
          Chaque génération est archivée — à conserver 5 ans.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {attestationManquante && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Renseignez votre n° d&apos;attestation de capacité dans
            Paramètres → Profil pour qu&apos;il apparaisse sur la fiche.
          </p>
        )}

        <Button type="button" onClick={() => setOpen(true)}>
          <FileCheck2 className="size-4" />
          Générer le CERFA 15497 (PDF)
        </Button>

        {documents.length > 0 && (
          <div className="divide-y rounded-md border">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <a
                  href={doc.url || "#"}
                  target="_blank"
                  rel="noopener"
                  className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-4 shrink-0" />
                  Fiche du {formatDateFr(doc.created_at)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {new Date(doc.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </a>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      disabled={pendingDelete === doc.id}
                    >
                      {pendingDelete === doc.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Supprimer cette archive ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Le PDF archivé sera supprimé. Rappel : la fiche
                        d&apos;intervention doit être conservée 5 ans —
                        ne supprimez que les versions régénérées.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(doc.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Générer le CERFA 15497</DialogTitle>
              <DialogDescription>
                Les données de l&apos;intervention (fluide, charge, contrôle
                d&apos;étanchéité, signatures) sont reprises automatiquement.
                Complétez les rubriques propres à la fiche.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fiche_numero">N° de fiche (optionnel)</Label>
                <Input
                  id="fiche_numero"
                  value={ficheNumero}
                  onChange={(e) => setFicheNumero(e.target.value)}
                  placeholder="Généré automatiquement si vide"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Nature de l&apos;intervention (cadre 4)</Label>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {(
                    Object.entries(NATURES_INTERVENTION) as Array<
                      [NatureIntervention, string]
                    >
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-[#2A7D5B]"
                        checked={natures.includes(key)}
                        onChange={() => toggleNature(key)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[#2A7D5B]"
                  checked={systemePermanent}
                  onChange={(e) => setSystemePermanent(e.target.checked)}
                />
                Système permanent de détection des fuites présent (cadre 6)
              </label>

              <div className="space-y-1.5">
                <Label>Quantités manipulées en kg (cadre 11)</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <KgInput
                    id="kg_vierge"
                    label="A — chargé vierge"
                    value={chargeVierge}
                    onChange={setChargeVierge}
                  />
                  <KgInput
                    id="kg_recycle"
                    label="B — chargé recyclé"
                    value={chargeRecycle}
                    onChange={setChargeRecycle}
                  />
                  <KgInput
                    id="kg_regenere"
                    label="C — chargé régénéré"
                    value={chargeRegenere}
                    onChange={setChargeRegenere}
                  />
                  <KgInput
                    id="kg_traitement"
                    label="D — récupéré (traitement)"
                    value={recupTraitement}
                    onChange={setRecupTraitement}
                  />
                  <KgInput
                    id="kg_reutilisation"
                    label="E — récupéré (réutilisation)"
                    value={recupReutilisation}
                    onChange={setRecupReutilisation}
                  />
                </div>
              </div>

              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[#2A7D5B]"
                  checked={avecDechets}
                  onChange={(e) => setAvecDechets(e.target.checked)}
                />
                L&apos;intervention génère des déchets de fluide (cadres 12-13)
              </label>

              {avecDechets && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="dechets_un">
                      Code UN / dénomination ADR
                    </Label>
                    <Input
                      id="dechets_un"
                      className="h-9"
                      placeholder="Ex : UN 3163, gaz liquéfié n.s.a."
                      value={dechetsCodeUn}
                      onChange={(e) => setDechetsCodeUn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="dechets_contenants">
                      Contenant(s) de récupération
                    </Label>
                    <Input
                      id="dechets_contenants"
                      className="h-9"
                      placeholder="Ex : bouteille de récupération n° 12"
                      value={dechetsContenants}
                      onChange={(e) => setDechetsContenants(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="dechets_bsff">
                      N° BSFF (Trackdéchets)
                    </Label>
                    <Input
                      id="dechets_bsff"
                      className="h-9"
                      value={dechetsBsff}
                      onChange={(e) => setDechetsBsff(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="dechets_dest">
                      Installation de destination
                    </Label>
                    <Input
                      id="dechets_dest"
                      className="h-9"
                      placeholder="Nom du collecteur / site"
                      value={dechetsDestNom}
                      onChange={(e) => setDechetsDestNom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs" htmlFor="dechets_dest_adr">
                      Adresse de destination
                    </Label>
                    <Input
                      id="dechets_dest_adr"
                      className="h-9"
                      value={dechetsDestAdresse}
                      onChange={(e) => setDechetsDestAdresse(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={generating}
              >
                Annuler
              </Button>
              <Button type="button" onClick={onGenerate} disabled={generating}>
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileCheck2 className="size-4" />
                )}
                Générer et archiver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
