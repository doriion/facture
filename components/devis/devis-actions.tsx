"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  BookmarkMinus,
  Check,
  Copy,
  Download,
  FilePlus2,
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
  setDevisModeleAction,
  setDevisStatutAction,
} from "@/lib/actions/devis";
import { Button } from "@/components/ui/button";
import { EmailDocumentButton } from "@/components/email-document-button";
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
  clientEmail,
  clientNom,
  estModele = false,
}: {
  devisId: string;
  numero: string;
  statut: string;
  factureId: string | null;
  clientEmail?: string | null;
  clientNom?: string;
  estModele?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function onToggleModele(next: boolean) {
    setPending("modele");
    const result = await setDevisModeleAction(devisId, next);
    setPending(null);
    if (result.ok) {
      toast.success(
        next
          ? `${numero} enregistré comme modèle`
          : `${numero} retiré des modèles`,
        {
          description: next
            ? "Il n'apparaît plus dans la liste des devis ni dans les stats."
            : "Il réapparaît dans la liste des devis.",
        },
      );
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

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

  // Vue « modèle » : actions réduites — un modèle ne s'envoie pas, ne se
  // convertit pas et ne change pas de statut ; il sert à créer des devis.
  if (estModele) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href={`/devis/nouveau?source=${devisId}`}>
            <FilePlus2 className="size-4" />
            Utiliser ce modèle
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/api/devis/${devisId}/pdf`} download>
            <Download className="size-4" />
            Télécharger PDF
          </a>
        </Button>
        <Button
          variant="outline"
          onClick={() => onToggleModele(false)}
          disabled={pending === "modele"}
        >
          {pending === "modele" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BookmarkMinus className="size-4" />
          )}
          Retirer des modèles
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" asChild>
        <a href={`/api/devis/${devisId}/pdf`} download>
          <Download className="size-4" />
          Télécharger PDF
        </a>
      </Button>

      {statut !== "refuse" && (
        <EmailDocumentButton
          documentId={devisId}
          type="devis"
          destinataireEmail={clientEmail ?? null}
          destinataireNom={clientNom ?? "le client"}
          variant="outline"
        />
      )}

      {/* Ouvre le formulaire de nouveau devis pré-rempli depuis celui-ci
          (sans client, dates du jour). Aucun numéro consommé avant la
          validation. */}
      <Button variant="outline" asChild>
        <Link href={`/devis/nouveau?source=${devisId}`}>
          <Copy className="size-4" />
          Dupliquer
        </Link>
      </Button>

      <Button
        variant="outline"
        onClick={() => onToggleModele(true)}
        disabled={pending === "modele"}
      >
        {pending === "modele" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bookmark className="size-4" />
        )}
        Enregistrer comme modèle
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
              {/* Sur mobile : ligne à part, éloignée des actions
                  courantes pour éviter les taps accidentels. */}
              <Button
                variant="outline"
                className="text-destructive max-sm:mt-1 max-sm:w-full"
              >
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
