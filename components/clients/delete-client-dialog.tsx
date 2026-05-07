"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteClientAction } from "@/lib/actions/clients";
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

/**
 * Bouton + confirmation de suppression d'un client.
 * Si le client a des factures/devis liés, l'action serveur renverra une
 * erreur explicite (FK restrict en base).
 */
export function DeleteClientDialog({
  clientId,
  clientNom,
  trigger,
}: {
  clientId: string;
  clientNom: string;
  trigger?: React.ReactNode;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function onConfirm() {
    setSubmitting(true);
    const result = await deleteClientAction(clientId);
    setSubmitting(false);

    if (result.ok) {
      toast.success("Client supprimé");
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Suppression impossible", { description: result.error });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{clientNom}</strong> va être supprimé. Cette action est
            irréversible. Si ce client a des factures ou devis enregistrés,
            la suppression sera refusée — vous devrez d'abord traiter ces
            documents.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
