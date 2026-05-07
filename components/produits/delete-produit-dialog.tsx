"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteProduitAction } from "@/lib/actions/produits";
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

export function DeleteProduitDialog({
  produitId,
  designation,
  trigger,
}: {
  produitId: string;
  designation: string;
  trigger?: React.ReactNode;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function onConfirm() {
    setSubmitting(true);
    const result = await deleteProduitAction(produitId);
    setSubmitting(false);

    if (result.ok) {
      toast.success("Prestation supprimée");
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
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
          <AlertDialogTitle>Supprimer cette prestation ?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{designation}</strong> sera supprimée définitivement.
            Les factures et devis qui l'utilisent déjà ne seront pas affectés.
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
