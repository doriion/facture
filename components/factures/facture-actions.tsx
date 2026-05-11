"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  Copy,
  Download,
  Loader2,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteFactureAction,
  duplicateFactureAction,
  setFactureStatutAction,
} from "@/lib/actions/factures";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { StatutFacture } from "@/lib/validations/facture";

/**
 * Boutons d'action contextuels selon le statut courant de la facture.
 * Affiché en haut de la page de détail.
 */
export function FactureActions({
  factureId,
  numero,
  statut,
}: {
  factureId: string;
  numero: string;
  statut: StatutFacture | string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function changeStatut(
    next: "brouillon" | "envoyee" | "payee" | "annulee",
    successMsg: string,
  ) {
    setPending(next);
    const result = await setFactureStatutAction(factureId, next);
    setPending(null);
    if (result.ok) {
      toast.success(successMsg);
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function onDelete() {
    setPending("delete");
    const result = await deleteFactureAction(factureId);
    setPending(null);
    if (result.ok) {
      toast.success("Brouillon supprimé");
      router.push("/factures");
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function onDuplicate() {
    setPending("duplicate");
    const result = await duplicateFactureAction(factureId);
    setPending(null);
    if (result.ok) {
      toast.success(`Facture ${result.data.numero} créée`, {
        description: "Brouillon dupliqué — modifiez avant envoi.",
      });
      router.push(`/factures/${result.data.factureId}`);
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" asChild>
        <a
          href={`/api/factures/${factureId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Download className="size-4" />
          Télécharger PDF
        </a>
      </Button>

      <Button
        variant="outline"
        onClick={onDuplicate}
        disabled={pending === "duplicate"}
      >
        {pending === "duplicate" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Copy className="size-4" />
        )}
        Dupliquer
      </Button>

      {statut === "brouillon" && (
        <>
          <Button
            onClick={() => changeStatut("envoyee", "Facture marquée envoyée")}
            disabled={pending === "envoyee"}
          >
            {pending === "envoyee" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Marquer envoyée
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="size-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce brouillon ?</AlertDialogTitle>
                <AlertDialogDescription>
                  La facture <strong>{numero}</strong> sera supprimée
                  définitivement. Cette action est possible uniquement parce
                  qu'elle est en brouillon — les factures envoyées doivent être
                  annulées (et non supprimées) pour respecter la traçabilité légale.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={pending === "delete"}
                >
                  {pending === "delete" && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {statut === "envoyee" && (
        <>
          <Button
            onClick={() => changeStatut("payee", "Facture marquée payée")}
            disabled={pending === "payee"}
          >
            {pending === "payee" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Marquer payée
          </Button>
          <Button
            variant="outline"
            onClick={() => changeStatut("brouillon", "Repassée en brouillon")}
            disabled={pending === "brouillon"}
          >
            {pending === "brouillon" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Undo2 className="size-4" />
            )}
            Repasser en brouillon
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => changeStatut("annulee", "Facture annulée")}
            disabled={pending === "annulee"}
          >
            <Ban className="size-4" />
            Annuler
          </Button>
        </>
      )}

      {statut === "payee" && (
        <Button
          variant="outline"
          onClick={() => changeStatut("envoyee", "Repassée en envoyée")}
          disabled={pending === "envoyee"}
        >
          <Undo2 className="size-4" />
          Annuler le paiement
        </Button>
      )}

      {statut === "annulee" && (
        <Button
          variant="outline"
          onClick={() => changeStatut("brouillon", "Facture restaurée en brouillon")}
          disabled={pending === "brouillon"}
        >
          <Undo2 className="size-4" />
          Restaurer en brouillon
        </Button>
      )}
    </div>
  );
}
