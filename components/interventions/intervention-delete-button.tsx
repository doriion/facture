"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteInterventionAction } from "@/lib/actions/interventions";
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

export function InterventionDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    setPending(true);
    const result = await deleteInterventionAction(id);
    setPending(false);
    if (result.ok) {
      toast.success("Intervention supprimée");
      router.push("/interventions");
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/* Sur mobile : ligne à part, éloignée du bouton « Créer la
            facture » pour éviter les taps accidentels. */}
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
          <AlertDialogTitle>Supprimer cette intervention ?</AlertDialogTitle>
          <AlertDialogDescription>
            La traçabilité des fluides frigorigènes pour cette intervention
            sera perdue. Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
