"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import {
  marquerDeclareeAction,
  supprimerDeclarationAction,
  type DeclarationUrssaf,
} from "@/lib/actions/declarations";
import {
  ecartDeclaration,
  LABELS_CASE_URSSAF,
  NATURES_FISCALES,
  type Ventilation,
} from "@/lib/fiscal";
import type { ExportPeriode } from "@/lib/exports/urssaf-helpers";
import { formatDateFr, formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * « Les chiffres à recopier » : les 3 cases du formulaire
 * autoentrepreneur.urssaf.fr avec bouton copier, le marquage
 * « période déclarée » et la détection d'écart si une facture ou un
 * paiement a bougé après la déclaration.
 */
export function DeclarationUrssafCard({
  periode,
  totalEncaisse,
  ventilation,
  declaration,
}: {
  periode: ExportPeriode;
  totalEncaisse: number;
  ventilation: Ventilation;
  declaration: DeclarationUrssaf | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);

  // Montant à copier : ENTIER, l'URSSAF arrondit à l'euro (le formulaire
  // n'accepte pas les centimes).
  const copier = async (montant: number, label: string) => {
    const arrondi = String(Math.round(montant));
    try {
      await navigator.clipboard.writeText(arrondi);
      toast.success(`${label} : ${arrondi} € copié`);
    } catch {
      toast.error("Copie impossible — sélectionnez le montant à la main.");
    }
  };

  const ecart = declaration
    ? ecartDeclaration(declaration.montant_declare, totalEncaisse)
    : null;

  async function onMarquerDeclaree() {
    setSaving(true);
    const res = await marquerDeclareeAction({
      label: periode.label,
      start: periode.start,
      end: periode.end,
      montant: totalEncaisse,
      ventilation,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${periode.label} marquée comme déclarée.`);
    router.refresh();
  }

  async function onAnnuler() {
    if (!declaration) return;
    setSaving(true);
    const res = await supprimerDeclarationAction(declaration.id);
    setSaving(false);
    setConfirmUndo(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Marquage retiré.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Les 3 cases du formulaire */}
      <div className="grid gap-2 sm:grid-cols-3">
        {NATURES_FISCALES.map((nature) => (
          <div
            key={nature}
            className={
              nature === "bic_prestations"
                ? "rounded-md border-2 border-primary bg-primary/5 p-3"
                : "rounded-md border p-3"
            }
          >
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
              {LABELS_CASE_URSSAF[nature]}
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-lg font-bold tabular-nums sm:text-xl">
                {formatEuros(ventilation[nature])}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() =>
                  copier(ventilation[nature], LABELS_CASE_URSSAF[nature])
                }
                aria-label={`Copier ${LABELS_CASE_URSSAF[nature]}`}
              >
                <ClipboardCopy className="size-4" />
                Copier
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Montants copiés arrondis à l&apos;euro (le formulaire URSSAF
        n&apos;accepte pas les centimes). À reporter sur{" "}
        <a
          href="https://www.autoentrepreneur.urssaf.fr"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          autoentrepreneur.urssaf.fr
        </a>
        .
      </p>

      {/* Statut déclaré / à déclarer */}
      {declaration ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-green-600/30 bg-green-500/5 p-3 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-green-600" />
            <span>
              Déclarée le {formatDateFr(declaration.declare_le)} —{" "}
              <strong>{formatEuros(declaration.montant_declare)}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setConfirmUndo(true)}
              disabled={saving}
            >
              <Undo2 className="size-4" />
              Annuler le marquage
            </Button>
          </div>
          {ecart !== null && (
            <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">
                  Écart de {formatEuros(Math.abs(ecart))}{" "}
                  {ecart > 0 ? "en plus" : "en moins"} depuis la déclaration.
                </p>
                <p className="text-xs text-muted-foreground">
                  Un paiement ou une facture a bougé après coup (total
                  actuel : {formatEuros(totalEncaisse)}). À régulariser sur
                  la prochaine déclaration, ou corrigez celle-ci sur le site
                  URSSAF puis re-marquez la période.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Button
          type="button"
          onClick={onMarquerDeclaree}
          disabled={saving || totalEncaisse === 0}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Marquer {periode.label || "la période"} comme déclarée
        </Button>
      )}

      <AlertDialog open={confirmUndo} onOpenChange={setConfirmUndo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le marquage ?</AlertDialogTitle>
            <AlertDialogDescription>
              La période ne sera plus suivie comme déclarée dans
              l&apos;application. Cela ne change évidemment rien à ce qui a
              été déclaré sur le site de l&apos;URSSAF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder</AlertDialogCancel>
            <AlertDialogAction onClick={onAnnuler}>
              Retirer le marquage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
