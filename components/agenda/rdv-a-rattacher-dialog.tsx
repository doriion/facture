"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { AgendaEvent } from "@/lib/actions/agenda";
import {
  listFacturesOuvertesAction,
  rattacherRdvAFactureAction,
  type FactureOuverte,
} from "@/lib/actions/agenda-rattachement";
import { heureCourte, libelleJour } from "@/lib/agenda-vues";
import { formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Le bandeau « RDV notés sur votre iPhone à rattacher » ouvre cette
 * liste : pour chaque RDV non rattaché, choisir une facture ouverte
 * (brouillon ou envoyée) et le rattacher en un clic — même table et
 * mêmes clés que « Évènements couverts » sur la fiche facture — ou
 * partir sur une nouvelle facture.
 */
export function RdvARattacherDialog({
  open,
  onOpenChange,
  rdvs,
  aujourdhui,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rdvs: AgendaEvent[];
  aujourdhui: string;
}) {
  const router = useRouter();
  const [factures, setFactures] = useState<FactureOuverte[] | null>(null);
  const [choix, setChoix] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!open || factures) return;
    listFacturesOuvertesAction()
      .then(setFactures)
      .catch(() => setFactures([]));
  }, [open, factures]);

  async function rattacher(e: AgendaEvent) {
    const factureId = choix[e.id];
    if (!factureId) return;
    setPending(e.id);
    const res = await rattacherRdvAFactureAction(factureId, {
      uid: e.id,
      title: e.title,
      date_start: e.date_start,
      date_end: e.date_end,
    });
    setPending(null);
    if (!res.ok) {
      toast.error("Rattachement impossible", { description: res.error });
      return;
    }
    toast.success(`RDV rattaché à la facture ${res.data.numero}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>RDV iPhone à rattacher</DialogTitle>
          <DialogDescription>
            {rdvs.length} RDV de ce mois ne sont liés à aucune facture. Rattachez
            chacun à une facture existante, ou créez la facture.
          </DialogDescription>
        </DialogHeader>

        {rdvs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tout est rattaché.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rdvs.map((e) => (
              <li key={e.id} className="space-y-2 px-3 py-3">
                <div>
                  <p className="text-sm font-medium">📱 {e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {libelleJour(e.date_start, aujourdhui)}
                    {e.heure_debut ? ` · ${heureCourte(e.heure_debut)}` : ""}
                    {e.lieu ? ` · ${e.lieu}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={choix[e.id] ?? ""}
                    onValueChange={(v) => setChoix((c) => ({ ...c, [e.id]: v }))}
                  >
                    <SelectTrigger className="w-full sm:w-72">
                      <SelectValue
                        placeholder={factures ? "Rattacher à une facture…" : "Chargement…"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(factures ?? []).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.numero} · {f.client_nom ?? "—"} · {formatDateFr(f.date_emission)}
                          {f.statut === "brouillon" ? " (brouillon)" : ""}
                        </SelectItem>
                      ))}
                      {factures && factures.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Aucune facture ouverte.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!choix[e.id] || pending === e.id}
                    onClick={() => rattacher(e)}
                  >
                    {pending === e.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Link2 className="size-4" />
                    )}
                    Rattacher
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/factures/nouvelle">
                      <FilePlus2 className="size-4" />
                      Créer la facture
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Après création d&apos;une facture, cochez le RDV dans sa section
          « Évènements couverts » — ou revenez ici pour le rattacher.
        </p>
      </DialogContent>
    </Dialog>
  );
}
