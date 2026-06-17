"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

import {
  addPaiementAction,
  deletePaiementAction,
} from "@/lib/actions/paiements";
import {
  LABELS_MODE_PAIEMENT,
  MODES_PAIEMENT,
  type FacturePaiementsSummary,
  type ModePaiement,
} from "@/lib/paiements-constants";
import { formatDateFr, formatEuros } from "@/lib/format";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

export function FacturePaiements({
  factureId,
  summary,
}: {
  factureId: string;
  summary: FacturePaiementsSummary;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const [datePaiement, setDatePaiement] = useState(today);
  const [montant, setMontant] = useState(
    summary.reste_du > 0 ? summary.reste_du.toFixed(2).replace(".", ",") : "",
  );
  const [mode, setMode] = useState<ModePaiement>("virement");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const allPaid = summary.reste_du <= 0.005;
  const progress =
    summary.total_facture > 0
      ? Math.min(100, (summary.total_encaisse / summary.total_facture) * 100)
      : 0;

  async function onAdd() {
    setSubmitting(true);
    const res = await addPaiementAction(factureId, {
      date_paiement: datePaiement,
      montant,
      mode,
      reference,
      notes,
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Paiement enregistré");
      setMontant("");
      setReference("");
      setNotes("");
      router.refresh();
    } else {
      toast.error("Erreur", { description: res.error });
    }
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deletePaiementAction(id);
      if (res.ok) {
        toast.success("Paiement supprimé");
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
          <Wallet className="size-4 text-primary" />
          Suivi des encaissements
        </CardTitle>
        <CardDescription>
          Enregistrez chaque versement (virement, chèque, espèces…). La facture
          passe automatiquement en « payée » quand tout est encaissé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Résumé + barre de progression */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total facture
              </p>
              <p className="font-semibold tabular-nums">
                {formatEuros(summary.total_facture)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Encaissé
              </p>
              <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatEuros(summary.total_encaisse)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Reste dû
              </p>
              <p
                className={cn(
                  "font-semibold tabular-nums",
                  summary.reste_du > 0
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground",
                )}
              >
                {formatEuros(summary.reste_du)}
              </p>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all",
                allPaid ? "bg-emerald-500" : "bg-amber-500",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Liste des paiements */}
        {summary.paiements.length > 0 && (
          <div className="rounded-md border">
            {summary.paiements.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm last:border-b-0"
              >
                <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="font-medium tabular-nums">
                    {formatEuros(p.montant)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateFr(p.date_paiement)} ·{" "}
                    {LABELS_MODE_PAIEMENT[p.mode as ModePaiement] ?? p.mode}
                    {p.reference && (
                      <span className="ml-1 font-mono">
                        — réf {p.reference}
                      </span>
                    )}
                  </span>
                  {p.notes && (
                    <span className="w-full text-xs italic text-muted-foreground">
                      {p.notes}
                    </span>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={pending}
                      title="Supprimer ce paiement"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Action irréversible. Si la facture était marquée
                        « payée » automatiquement, elle repasse en « envoyée ».
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(p.id)}
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

        {/* Formulaire d'ajout */}
        {!allPaid && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Enregistrer un paiement
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="pmt_date" className="text-xs">
                  Date *
                </Label>
                <Input
                  id="pmt_date"
                  type="date"
                  value={datePaiement}
                  onChange={(e) => setDatePaiement(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pmt_montant" className="text-xs">
                  Montant € *
                </Label>
                <Input
                  id="pmt_montant"
                  type="text"
                  inputMode="decimal"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0,00"
                  className="h-9 text-right"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pmt_mode" className="text-xs">
                  Mode *
                </Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as ModePaiement)}
                >
                  <SelectTrigger id="pmt_mode" className="h-9">
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
              <div className="space-y-1">
                <Label htmlFor="pmt_ref" className="text-xs">
                  Référence
                </Label>
                <Input
                  id="pmt_ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="N° chèque, virement…"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pmt_notes" className="text-xs">
                Notes
              </Label>
              <Input
                id="pmt_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Acompte 30%, etc."
                className="h-9"
              />
            </div>
            <Button onClick={onAdd} disabled={submitting} size="sm">
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Ajouter le paiement
            </Button>
          </div>
        )}

        {allPaid && summary.total_facture > 0 && (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100">
            ✅ Facture entièrement encaissée.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
