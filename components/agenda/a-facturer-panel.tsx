"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, ChevronRight, Link2, Loader2, Receipt, XCircle } from "lucide-react";
import { toast } from "sonner";

import type { AFacturerItem } from "@/lib/actions/agenda";
import { setInterventionAFacturerAction } from "@/lib/actions/interventions";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";
import { formatDateFr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ClientARenseignerBadge } from "@/components/agenda/evenement-commun";

const VISIBLES_PAR_DEFAUT = 8;

/**
 * Panneau « À facturer » (PC) : toutes les interventions passées sans
 * facture ni « rien à facturer », quel que soit le mois affiché, avec
 * deux actions par ligne — créer la facture, ou dire que cette entrée
 * n'a rien à facturer. Les RDV iPhone à rattacher ont leur bouton.
 */
export function AFacturerPanel({
  items,
  nbExternal,
  onRattacher,
  className,
}: {
  items: AFacturerItem[];
  nbExternal: number;
  onRattacher: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(true);
  const [tout, setTout] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  if (items.length === 0 && nbExternal === 0) return null;

  async function rienAFacturer(it: AFacturerItem) {
    setPending(it.id);
    const res = await setInterventionAFacturerAction(it.id, false);
    setPending(null);
    if (!res.ok) {
      toast.error("Erreur", { description: res.error });
      return;
    }
    toast.success("Marquée « rien à facturer »", {
      description: "Modifiable depuis la fiche ou le détail de l'évènement.",
    });
    router.refresh();
  }

  const visibles = tout ? items : items.slice(0, VISIBLES_PAR_DEFAUT);

  return (
    <div
      className={cn(
        "rounded-md border border-amber-300 bg-amber-50 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <AlertCircle className="size-4 shrink-0" />
        <span className="flex-1 font-medium">
          {items.length > 0 && (
            <>
              {items.length} intervention{items.length > 1 ? "s" : ""} passée
              {items.length > 1 ? "s" : ""} à facturer
            </>
          )}
          {items.length > 0 && nbExternal > 0 && " · "}
          {nbExternal > 0 && (
            <>
              {nbExternal} RDV iPhone à rattacher
            </>
          )}
        </span>
        {ouvert ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>

      {ouvert && (
        <div className="space-y-2 border-t border-amber-200 px-4 py-3 dark:border-amber-800">
          {visibles.length > 0 && (
            <ul className="divide-y divide-amber-200 dark:divide-amber-800">
              {visibles.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="w-24 shrink-0 tabular-nums">{formatDateFr(it.date_intervention)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">
                      {it.description ||
                        LABELS_TYPE_INTERVENTION[it.type as keyof typeof LABELS_TYPE_INTERVENTION] ||
                        it.type}
                    </span>
                    {it.client_nom ? (
                      <span className="opacity-80"> · {it.client_nom}</span>
                    ) : (
                      <span className="ml-2 inline-block align-middle"><ClientARenseignerBadge /></span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Button asChild size="sm" variant="outline" className="bg-background">
                      <Link href={`/factures/nouvelle?intervention=${it.id}`}>
                        <Receipt className="size-4" />
                        Créer la facture
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Rien à facturer pour cette entrée (déplacement, outils, perso…)"
                      disabled={pending === it.id}
                      onClick={() => rienAFacturer(it)}
                    >
                      {pending === it.id ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                      Rien à facturer
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {items.length > VISIBLES_PAR_DEFAUT && (
            <button
              type="button"
              onClick={() => setTout((v) => !v)}
              className="text-xs underline-offset-2 hover:underline"
            >
              {tout ? "Réduire" : `Voir tout (${items.length})`}
            </button>
          )}
          {nbExternal > 0 && (
            <Button size="sm" variant="outline" className="bg-background" onClick={onRattacher}>
              <Link2 className="size-4" />
              {nbExternal > 1 ? `Rattacher les ${nbExternal} RDV iPhone` : "Rattacher le RDV iPhone"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
