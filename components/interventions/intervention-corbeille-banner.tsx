"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { restaurerInterventionAction } from "@/lib/actions/interventions";
import { ageCorbeille } from "@/lib/corbeille";
import { Button } from "@/components/ui/button";

/** Fiche d'une intervention à la corbeille : la restaurer, ou aller l'effacer. */
export function InterventionCorbeilleBanner({ id, supprimeLe }: { id: string; supprimeLe: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function restaurer() {
    setPending(true);
    const r = await restaurerInterventionAction(id);
    setPending(false);
    if (!r.ok) {
      toast.error("Restauration refusée", { description: r.error });
      return;
    }
    toast.success("Intervention restaurée");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <p className="flex items-center gap-2">
        <Trash2 className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <span>
          <strong>Dans la corbeille</strong> — supprimée {ageCorbeille(supprimeLe)}. Elle
          n&apos;apparaît plus dans l&apos;agenda ni dans les listes.
        </span>
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={restaurer} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          Restaurer
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/interventions/corbeille">Corbeille</Link>
        </Button>
      </div>
    </div>
  );
}
