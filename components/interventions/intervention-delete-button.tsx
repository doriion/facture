"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteInterventionAction,
  restaurerInterventionAction,
} from "@/lib/actions/interventions";
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
 * Depuis la fiche : mise à la CORBEILLE (rien n'est effacé), retour à la
 * liste, et « Annuler » dans le message pour la faire revenir. L'effacement
 * réel se fait depuis la corbeille (« Supprimer définitivement »).
 */
export function InterventionDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    setPending(true);
    const result = await deleteInterventionAction(id);
    setPending(false);
    if (!result.ok) {
      toast.error("Erreur", { description: result.error });
      return;
    }
    toast.success("Intervention mise à la corbeille", {
      duration: 8000,
      action: {
        label: "Annuler",
        onClick: async () => {
          const r = await restaurerInterventionAction(id);
          if (!r.ok) {
            toast.error("Restauration refusée", { description: r.error });
            return;
          }
          toast.success("Intervention restaurée");
          router.push(`/interventions/${id}`);
          router.refresh();
        },
      },
    });
    router.push("/interventions");
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
          <AlertDialogTitle>Mettre cette intervention à la corbeille ?</AlertDialogTitle>
          <AlertDialogDescription>
            Elle disparaît de l&apos;agenda et des listes, mais rien n&apos;est
            effacé : vous pourrez l&apos;annuler tout de suite ou la restaurer
            depuis la corbeille des interventions. Photos, signatures et
            fiches CERFA restent attachées.
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
            Mettre à la corbeille
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
