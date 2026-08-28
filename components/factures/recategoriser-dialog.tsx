"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Tags } from "lucide-react";
import { toast } from "sonner";

import { bulkSetTypeActiviteAction } from "@/lib/actions/factures";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";
import { formatDateFr, formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type FactureARecategoriser = {
  id: string;
  numero: string;
  date_emission: string;
  total_ht: number;
  client_nom: string | null;
};

/**
 * Nettoyage des factures classées « Autre » : bandeau discret sur la
 * liste + dialogue de recatégorisation en masse (un select par
 * facture, seules les lignes modifiées sont enregistrées). Le type
 * d'activité est un axe d'ANALYSE — pas une mention légale figée — le
 * recatégoriser ne touche ni montants ni mentions.
 */
export function RecategoriserBanner({
  factures,
}: {
  factures: FactureARecategoriser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [choix, setChoix] = useState<Record<string, string>>({});

  if (factures.length === 0) return null;

  const nbChoisis = Object.values(choix).filter(Boolean).length;

  async function onSave() {
    const updates = Object.entries(choix)
      .filter(([, type]) => type)
      .map(([id, type_activite]) => ({ id, type_activite }));
    if (updates.length === 0) return;
    setSaving(true);
    const res = await bulkSetTypeActiviteAction(updates);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${res.data.nb} facture${res.data.nb > 1 ? "s" : ""} recatégorisée${res.data.nb > 1 ? "s" : ""}.`,
    );
    setChoix({});
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm">
        <Tags className="size-4 shrink-0 text-amber-600" />
        <span className="min-w-0 flex-1">
          {factures.length} facture{factures.length > 1 ? "s" : ""} classée
          {factures.length > 1 ? "s" : ""} « Autre » — la répartition par
          activité du tableau de bord n&apos;apprend rien tant qu&apos;elles
          ne sont pas requalifiées.
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Recatégoriser
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recatégoriser les factures « Autre »</DialogTitle>
            <DialogDescription>
              Choisissez le bon type d&apos;activité pour chaque facture.
              Les lignes laissées sur « — » ne sont pas modifiées.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-y rounded-md border">
            {factures.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center gap-2 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-medium">{f.numero}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateFr(f.date_emission)} ·{" "}
                    {f.client_nom ?? "(client supprimé)"} ·{" "}
                    {formatEuros(f.total_ht)}
                  </p>
                </div>
                <select
                  className="h-9 shrink-0 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Type d'activité pour ${f.numero}`}
                  value={choix[f.id] ?? ""}
                  onChange={(e) =>
                    setChoix((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                >
                  <option value="">—</option>
                  {Object.entries(LABELS_TYPE_ACTIVITE).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={saving || nbChoisis === 0}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Appliquer ({nbChoisis})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
