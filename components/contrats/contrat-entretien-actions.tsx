"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Pencil, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  changerStatutContratAction,
  deleteContratEntretienAction,
  type ContratEntretienRow,
} from "@/lib/actions/contrats-entretien";
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
 * Actions de la fiche contrat côté admin. L'envoi au client arrive à
 * l'étape emails ; ici : modifier / supprimer (brouillon), passer en
 * actif (signé), résilier (signé/actif).
 */
export function ContratEntretienActions({
  contrat,
}: {
  contrat: ContratEntretienRow;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function changerStatut(statut: string, message: string) {
    setPending(true);
    const res = await changerStatutContratAction(contrat.id, statut);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(message);
    router.refresh();
  }

  async function supprimer() {
    setPending(true);
    const res = await deleteContratEntretienAction(contrat.id);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Brouillon supprimé.");
    router.push("/contrats");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {contrat.statut === "brouillon" && (
        <>
          <Button variant="outline" asChild>
            <Link href={`/contrats/${contrat.id}/modifier`}>
              <Pencil className="size-4" />
              Modifier
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={pending}>
                <Trash2 className="size-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce brouillon ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Le brouillon sera définitivement supprimé.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={supprimer}>
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {contrat.statut === "signe" && (
        <Button
          disabled={pending}
          onClick={() =>
            changerStatut(
              "actif",
              "Contrat actif — pensez à créer le suivi de maintenance.",
            )
          }
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Passer en actif
        </Button>
      )}

      {(contrat.statut === "signe" || contrat.statut === "actif") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={pending}>
              <XCircle className="size-4" />
              Résilier
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Résilier ce contrat ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le contrat passera au statut « résilié ». Le PDF signé et
                les preuves restent archivés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => changerStatut("resilie", "Contrat résilié.")}
              >
                Résilier
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
