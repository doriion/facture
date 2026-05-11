"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  Send,
  ThumbsDown,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import {
  convertirDevisEnFactureAction,
  deleteDevisAction,
  duplicateDevisAction,
  setDevisStatutAction,
} from "@/lib/actions/devis";
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

/**
 * Actions contextuelles d'un devis selon son statut + bouton "Convertir en facture".
 */
export function DevisActions({
  devisId,
  numero,
  statut,
  factureId,
}: {
  devisId: string;
  numero: string;
  statut: string;
  factureId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function changeStatut(
    next: "brouillon" | "envoye" | "accepte" | "refuse",
    successMsg: string,
  ) {
    setPending(next);
    const result = await setDevisStatutAction(devisId, next);
    setPending(null);
    if (result.ok) {
      toast.success(successMsg);
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function onConvertir() {
    setPending("convertir");
    const result = await convertirDevisEnFactureAction(devisId);
    setPending(null);
    if (result.ok) {
      toast.success(`Facture ${result.data.numero} créée`, {
        description: "Le devis a été marqué accepté.",
      });
      router.push(`/factures/${result.data.factureId}`);
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function onDelete() {
    setPending("delete");
    const result = await deleteDevisAction(devisId);
    setPending(null);
    if (result.ok) {
      toast.success("Brouillon supprimé");
      router.push("/devis");
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function onDuplicate() {
    setPending("duplicate");
    const result = await duplicateDevisAction(devisId);
    setPending(null);
    if (result.ok) {
      toast.success(`Devis ${result.data.numero} créé`, {
        description: "Brouillon dupliqué — modifiez avant envoi.",
      });
      router.push(`/devis/${result.data.devisId}`);
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" asChild>
        <a
          href={`/api/devis/${devisId}/pdf`}
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

      {factureId && (
        <Button variant="outline" asChild>
          <a href={`/factures/${factureId}`}>
            <FileText className="size-4" />
            Voir la facture
          </a>
        </Button>
      )}

      {statut === "brouillon" && (
        <>
          <Button
            onClick={() => changeStatut("envoye", "Devis marqué envoyé")}
            disabled={pending === "envoye"}
          >
            {pending === "envoye" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Marquer envoyé
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
                  Le devis <strong>{numero}</strong> sera supprimé
                  définitivement.
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

      {statut === "envoye" && (
        <>
          <Button
            onClick={() => changeStatut("accepte", "Devis accepté")}
            disabled={pending === "accepte"}
          >
            {pending === "accepte" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Marquer accepté
          </Button>
          <Button
            variant="outline"
            onClick={() => changeStatut("refuse", "Devis refusé")}
            disabled={pending === "refuse"}
          >
            <ThumbsDown className="size-4" />
            Marquer refusé
          </Button>
          <Button
            variant="outline"
            onClick={() => changeStatut("brouillon", "Repassé en brouillon")}
            disabled={pending === "brouillon"}
          >
            <Undo2 className="size-4" />
            Repasser en brouillon
          </Button>
        </>
      )}

      {statut === "accepte" && !factureId && (
        <Button
          onClick={onConvertir}
          disabled={pending === "convertir"}
        >
          {pending === "convertir" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
          Convertir en facture
        </Button>
      )}

      {(statut === "refuse" || statut === "expire") && (
        <Button
          variant="outline"
          onClick={() => changeStatut("brouillon", "Repassé en brouillon")}
          disabled={pending === "brouillon"}
        >
          <Undo2 className="size-4" />
          Repasser en brouillon
        </Button>
      )}
    </div>
  );
}
