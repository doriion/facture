"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { addPaiementAction, getFacturePaiements } from "@/lib/actions/paiements";
import {
  LABELS_MODE_PAIEMENT,
  MODES_PAIEMENT,
  type ModePaiement,
} from "@/lib/paiements-constants";
import { estSoldee, montantRestant } from "@/lib/paiements-helpers";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Bouton « Marquer payée » : ouvre une fenêtre pré-remplie (date du
 * jour, montant = reste dû, mode à choisir) qui ENREGISTRE UN PAIEMENT.
 * Le statut « payée » découle de l'encaissement (statut dérivé des
 * paiements) — ainsi le CA encaissé (jauges dashboard, export URSSAF)
 * reste cohérent avec les statuts.
 *
 * `compact` : variante réduite pour les lignes de la table factures.
 */
export function MarquerPayeeButton({
  factureId,
  compact = false,
}: {
  factureId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [totalFacture, setTotalFacture] = useState<number | null>(null);
  const [dejaEncaisse, setDejaEncaisse] = useState(0);
  const [date, setDate] = useState("");
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState<ModePaiement>("virement");

  // Pré-remplissage à l'ouverture : date du jour + reste dû réel
  // (tient compte d'éventuels acomptes déjà enregistrés).
  useEffect(() => {
    if (!open) return;
    setDate(new Date().toISOString().slice(0, 10));
    setLoading(true);
    getFacturePaiements(factureId).then((summary) => {
      setTotalFacture(summary.total_facture);
      setDejaEncaisse(summary.total_encaisse);
      setMontant(summary.reste_du.toFixed(2).replace(".", ","));
      setLoading(false);
    });
  }, [open, factureId]);

  async function onConfirm() {
    setSaving(true);
    const result = await addPaiementAction(factureId, {
      date_paiement: date,
      montant,
      mode,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("Erreur", { description: result.error });
      return;
    }
    const montantNum = parseMoneyInput(montant);
    const resteApres =
      totalFacture !== null
        ? montantRestant(totalFacture, dejaEncaisse + montantNum)
        : 0;
    if (estSoldee(resteApres)) {
      toast.success("Paiement enregistré — facture marquée payée");
    } else {
      toast.success("Paiement partiel enregistré", {
        description: `Il reste ${formatEuros(resteApres)} à encaisser — la facture reste « envoyée ».`,
      });
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {compact ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="h-7 gap-1 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          title="Enregistrer l'encaissement et marquer la facture payée"
        >
          <Check className="size-3.5" />
          Payée
        </Button>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          <Check className="size-4" />
          Marquer payée
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onClick={(e) => e.stopPropagation()}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Enregistrer l&apos;encaissement</DialogTitle>
            <DialogDescription>
              Marquer la facture payée enregistre un paiement — c&apos;est lui
              qui alimente le CA encaissé (jauges du tableau de bord, export
              URSSAF).
              {totalFacture !== null && dejaEncaisse > 0 && (
                <>
                  {" "}
                  Total {formatEuros(totalFacture)}, déjà encaissé{" "}
                  {formatEuros(dejaEncaisse)}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paiement-date">Date d&apos;encaissement</Label>
                <Input
                  id="paiement-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paiement-montant">Montant (€)</Label>
                <Input
                  id="paiement-montant"
                  type="text"
                  inputMode="decimal"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Mode de paiement</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as ModePaiement)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES_PAIEMENT.map((m) => (
                      <SelectItem key={m} value={m}>
                        {LABELS_MODE_PAIEMENT[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button onClick={onConfirm} disabled={saving || loading || !date}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Encaisser et marquer payée
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
