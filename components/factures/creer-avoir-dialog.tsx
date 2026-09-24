"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createAvoirAction } from "@/lib/actions/factures";
import { appelerAction } from "@/lib/appel-action";
import {
  LABELS_MODE_AVOIR,
  MODES_AVOIR,
  montantAvoirMax,
  type ModeAvoir,
} from "@/lib/factures-transitions";
import { formatEuros, parseMoneyInput } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * « Créer un avoir » depuis une facture émise. Le mode est proposé selon
 * la situation (reste dû → imputation, facture encaissée → remboursement),
 * le montant est plafonné (lib/factures-transitions), le motif est
 * obligatoire (mention du document). L'avoir est créé en brouillon,
 * numéroté A-AAAA-NNNN, puis ouvert.
 */
export function CreerAvoirDialog({
  factureId,
  numero,
  totalFacture,
  totalEncaisse,
  avoirsImputes,
  avoirsRembourses,
}: {
  factureId: string;
  numero: string;
  totalFacture: number;
  totalEncaisse: number;
  avoirsImputes: number;
  avoirsRembourses: number;
}) {
  const router = useRouter();
  const ctx = { totalFacture, totalEncaisse, avoirsImputes, avoirsRembourses };
  const maxImputation = montantAvoirMax("imputation", ctx);
  const maxRemboursement = montantAvoirMax("remboursement", ctx);
  const modeInitial: ModeAvoir = maxImputation > 0 ? "imputation" : "remboursement";

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<ModeAvoir>(modeInitial);
  const [montant, setMontant] = useState(formatSaisie(montantAvoirMax(modeInitial, ctx)));
  const [motif, setMotif] = useState("");

  const max = montantAvoirMax(mode, ctx);
  const montantNum = parseMoneyInput(montant);
  const montantValide = Number.isFinite(montantNum) && montantNum > 0 && montantNum <= max + 0.011;
  const avoirTotal = Math.abs(montantNum - totalFacture) < 0.005;

  function choisirMode(m: ModeAvoir) {
    setMode(m);
    setMontant(formatSaisie(montantAvoirMax(m, ctx)));
  }

  async function onCreate() {
    if (!motif.trim()) {
      toast.error("Motif obligatoire", {
        description: "Le motif figure sur l'avoir : erreur de montant, prestation non réalisée, geste commercial…",
      });
      return;
    }
    setSaving(true);
    const res = await appelerAction(() =>
      createAvoirAction(factureId, { mode, montant: montantNum, motif: motif.trim() }),
    );
    setSaving(false);
    if (!res.ok) {
      toast.error("Avoir refusé", { description: res.error });
      return;
    }
    toast.success(`Avoir ${res.data.numero} créé en brouillon`, {
      description: "Vérifiez les lignes puis « Émettre l'avoir ».",
    });
    setOpen(false);
    router.push(`/factures/${res.data.factureId}`);
  }

  if (maxImputation <= 0 && maxRemboursement <= 0) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileMinus className="size-4" />
        Créer un avoir
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Avoir sur la facture {numero}</DialogTitle>
            <DialogDescription>
              Une facture émise ne se modifie pas : l&apos;avoir la corrige en
              gardant la trace. Il est numéroté dans sa propre séquence
              (A-AAAA-NNNN) et mentionne la facture d&apos;origine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Que devient le montant ?</legend>
              {MODES_AVOIR.map((m) => {
                const plafond = montantAvoirMax(m, ctx);
                return (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${
                      plafond <= 0 ? "opacity-50" : ""
                    } ${mode === m ? "border-primary bg-primary/5" : ""}`}
                  >
                    <input
                      type="radio"
                      name="mode_avoir"
                      className="mt-0.5 accent-primary"
                      checked={mode === m}
                      disabled={plafond <= 0}
                      onChange={() => choisirMode(m)}
                    />
                    <span>
                      <span className="block font-medium">{LABELS_MODE_AVOIR[m]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {plafond > 0
                          ? `Jusqu'à ${formatEuros(plafond)}`
                          : m === "imputation"
                            ? "Rien à imputer : la facture est soldée."
                            : "Rien à rembourser : aucun encaissement."}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="avoir-montant">Montant de l&apos;avoir (€)</Label>
              <Input
                id="avoir-montant"
                type="text"
                inputMode="decimal"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                aria-invalid={!montantValide}
              />
              <p className="text-xs text-muted-foreground">
                {avoirTotal
                  ? "Avoir total : les lignes de la facture seront reprises."
                  : "Avoir partiel : une ligne unique portera le montant et le motif."}
                {!montantValide && montant && (
                  <span className="block text-destructive">
                    Montant entre 0,01 € et {formatEuros(max)}.
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avoir-motif">Motif (imprimé sur l&apos;avoir) *</Label>
              <Textarea
                id="avoir-motif"
                rows={2}
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex : erreur de quantité sur la ligne 2, prestation non réalisée, geste commercial…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={onCreate} disabled={saving || !montantValide || !motif.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <FileMinus className="size-4" />}
              Créer l&apos;avoir (brouillon)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatSaisie(n: number): string {
  return n > 0 ? n.toFixed(2).replace(".", ",") : "";
}
