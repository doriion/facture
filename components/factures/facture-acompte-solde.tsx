"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Layers, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createAcompteAction,
  createSoldeAction,
} from "@/lib/actions/factures";
import { formatDateFr, formatEuros, parseMoneyInput } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { StatutBadge } from "@/components/factures/statut-badge";

type FactureEnfant = {
  id: string;
  numero: string;
  type_facture: string;
  statut: string;
  total_ht: number | string;
  date_emission: string;
  pourcentage_acompte: number | null;
};

export function FactureAcompteSolde({
  factureId,
  totalParent,
  enfants,
}: {
  factureId: string;
  totalParent: number;
  enfants: FactureEnfant[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [acompteOpen, setAcompteOpen] = useState(false);
  const [mode, setMode] = useState<"pct" | "montant">("pct");
  const [pct, setPct] = useState("30");
  const [montant, setMontant] = useState("");

  const acomptes = enfants.filter((e) => e.type_facture === "acompte");
  const soldes = enfants.filter((e) => e.type_facture === "solde");
  const totalAcomptes = acomptes
    .filter((a) => a.statut !== "annulee")
    .reduce((s, a) => s + Number(a.total_ht), 0);
  const reste = Math.max(0, totalParent - totalAcomptes);
  const hasSolde = soldes.some((s) => s.statut !== "annulee");

  async function handleAddAcompte() {
    const payload =
      mode === "pct"
        ? { pourcentage: Number(pct) }
        : { montant: parseMoneyInput(montant) };
    startTransition(async () => {
      const res = await createAcompteAction(factureId, payload);
      if (res.ok) {
        toast.success(`Acompte ${res.data.numero} créé`);
        setAcompteOpen(false);
        router.refresh();
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  }

  async function handleSolde() {
    startTransition(async () => {
      const res = await createSoldeAction(factureId);
      if (res.ok) {
        toast.success(`Facture de solde ${res.data.numero} créée`);
        router.push(`/factures/${res.data.factureId}`);
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="size-4 text-primary" />
          Acomptes &amp; facture de solde
        </CardTitle>
        <CardDescription>
          Pour les gros chantiers : facturez un acompte à la commande, le
          solde à la fin. Cette facture sert de référence (montant total).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Résumé */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total chantier
            </p>
            <p className="font-semibold tabular-nums">
              {formatEuros(totalParent)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Acomptes
            </p>
            <p className="font-semibold tabular-nums">
              {formatEuros(totalAcomptes)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Reste à facturer
            </p>
            <p className="font-semibold tabular-nums">{formatEuros(reste)}</p>
          </div>
        </div>

        {/* Liste enfants */}
        {enfants.length > 0 && (
          <div className="space-y-1">
            {enfants.map((e) => (
              <Link
                key={e.id}
                href={`/factures/${e.id}`}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{e.numero}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {e.type_facture === "acompte"
                      ? e.pourcentage_acompte
                        ? `Acompte ${e.pourcentage_acompte}%`
                        : "Acompte"
                      : "Solde"}
                  </span>
                  <StatutBadge statut={e.statut} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDateFr(e.date_emission)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatEuros(Number(e.total_ht))}
                  </span>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAcompteOpen(true)}
            disabled={pending || reste <= 0}
          >
            <Plus className="size-4" />
            Nouvel acompte
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSolde}
            disabled={pending || reste <= 0 || hasSolde || acomptes.length === 0}
            title={
              hasSolde
                ? "Une facture de solde existe déjà"
                : acomptes.length === 0
                  ? "Créez d'abord au moins un acompte"
                  : ""
            }
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Layers className="size-4" />
            )}
            Générer le solde ({formatEuros(reste)})
          </Button>
        </div>

        <Dialog open={acompteOpen} onOpenChange={setAcompteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une facture d'acompte</DialogTitle>
              <DialogDescription>
                Génère un brouillon facture lié à celle-ci. Vous pourrez
                ensuite l'envoyer au client.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={mode === "pct" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("pct")}
                >
                  Pourcentage
                </Button>
                <Button
                  type="button"
                  variant={mode === "montant" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("montant")}
                >
                  Montant €
                </Button>
              </div>
              {mode === "pct" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="acompte_pct">Pourcentage (1-100)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="acompte_pct"
                      type="text"
                      inputMode="decimal"
                      value={pct}
                      onChange={(e) => setPct(e.target.value)}
                      className="text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Soit{" "}
                    <strong>
                      {formatEuros(
                        Math.round(
                          totalParent * (Number(pct) / 100) * 100,
                        ) / 100,
                      )}
                    </strong>{" "}
                    sur {formatEuros(totalParent)} HT.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="acompte_montant">Montant HT (€)</Label>
                  <Input
                    id="acompte_montant"
                    type="text"
                    inputMode="decimal"
                    value={montant}
                    onChange={(e) => setMontant(e.target.value)}
                    placeholder="0,00"
                    className="text-right"
                  />
                  <p className="text-xs text-muted-foreground">
                    Doit être &lt; {formatEuros(totalParent)}.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAcompteOpen(false)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button onClick={handleAddAcompte} disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Créer l'acompte
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
