"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setFactureStatutAction } from "@/lib/actions/factures";
import { Button } from "@/components/ui/button";

/**
 * Bouton compact « Marquer payée » à afficher dans la table factures.
 * 1 clic = facture passée au statut "payee", revalidate, toast.
 * À n'utiliser que sur les factures dont le statut le permet
 * (envoyee, retard) — sinon ne rien rendre.
 */
export function MarkAsPaidButton({ factureId }: { factureId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    const result = await setFactureStatutAction(factureId, "payee");
    setPending(false);
    if (result.ok) {
      toast.success("Facture marquée payée");
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending}
      className="h-7 gap-1 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      title="Marquer cette facture comme payée"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Check className="size-3.5" />
      )}
      Payée
    </Button>
  );
}
