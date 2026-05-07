"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteContratAction,
  genererFactureVisiteAction,
} from "@/lib/actions/contrats";
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
import { Button } from "@/components/ui/button";

export function ContratActions({
  contratId,
  statut,
}: {
  contratId: string;
  statut: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function genererFacture() {
    setPending("facture");
    const result = await genererFactureVisiteAction(contratId);
    setPending(null);
    if (result.ok) {
      toast.success(`Facture ${result.data.numero} créée`, {
        description: "La prochaine visite a été avancée selon la fréquence.",
      });
      router.push(`/factures/${result.data.factureId}`);
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function onDelete() {
    setPending("delete");
    const result = await deleteContratAction(contratId);
    setPending(null);
    if (result.ok) {
      toast.success("Contrat supprimé");
      router.push("/maintenance");
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {statut === "actif" && (
        <Button onClick={genererFacture} disabled={pending === "facture"}>
          {pending === "facture" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileText className="size-4" />
          )}
          Générer la facture de visite
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="text-destructive">
            <Trash2 className="size-4" />
            Supprimer
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contrat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les factures déjà générées
              depuis ce contrat ne seront pas supprimées.
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
    </div>
  );
}
