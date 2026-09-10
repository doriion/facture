"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  FileDown,
  Link2Off,
  Loader2,
  Pencil,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  changerStatutContratAction,
  deleteContratEntretienAction,
  envoyerContratAction,
  revoquerLienContratAction,
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

  async function envoyer() {
    setPending(true);
    const res = await envoyerContratAction(contrat.id);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      router.refresh();
      return;
    }
    toast.success(
      contrat.statut === "envoye"
        ? "Nouveau lien envoyé au client (l'ancien est mort)."
        : "Contrat envoyé au client pour signature.",
    );
    router.refresh();
  }

  async function revoquer() {
    setPending(true);
    const res = await revoquerLienContratAction(contrat.id);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Lien révoqué — le client ne peut plus signer.");
    router.refresh();
  }

  function copierLien() {
    if (!contrat.access_token) return;
    void navigator.clipboard
      .writeText(`${window.location.origin}/c/${contrat.access_token}`)
      .then(() => toast.success("Lien de signature copié."));
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
      <Button variant="outline" asChild>
        <a href={`/api/contrats/${contrat.id}/pdf`}>
          <FileDown className="size-4" />
          {contrat.statut === "brouillon" ? "Aperçu PDF" : "PDF"}
        </a>
      </Button>
      {(contrat.statut === "brouillon" || contrat.statut === "envoye") && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {contrat.statut === "envoye"
                ? "Renvoyer au client"
                : "Envoyer au client"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {contrat.statut === "envoye"
                  ? "Renvoyer le contrat ?"
                  : "Envoyer le contrat pour signature ?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {contrat.statut === "envoye"
                  ? "Un NOUVEAU lien de signature (valable 30 jours) sera envoyé par email — l'ancien lien cessera de fonctionner."
                  : "Vos coordonnées et celles du client seront figées, le numéro attribué, et le client recevra par email un lien de signature valable 30 jours. Le contrat ne sera plus modifiable."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={envoyer}>Envoyer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {contrat.statut === "envoye" && contrat.access_token && (
        <>
          <Button variant="outline" onClick={copierLien}>
            <Copy className="size-4" />
            Copier le lien
          </Button>
          <Button variant="outline" onClick={revoquer} disabled={pending}>
            <Link2Off className="size-4" />
            Révoquer le lien
          </Button>
        </>
      )}

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
