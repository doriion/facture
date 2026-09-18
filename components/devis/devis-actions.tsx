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
  FileWarning,
  Loader2,
  Pencil,
  Send,
  ThumbsDown,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import {
  convertirDevisEnFactureAction,
  deleteDevisAction,
  renommerModeleDevisAction,
  setDevisModeleAction,
  setDevisStatutAction,
} from "@/lib/actions/devis";
import { Button } from "@/components/ui/button";
import { EmailDocumentButton } from "@/components/email-document-button";
import { NomModeleDialog } from "@/components/devis/nom-modele-dialog";
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
  nomModele = null,
  signee = false,
  pdfBloqueMotif = null,
}: {
  devisId: string;
  numero: string;
  statut: string;
  factureId: string | null;
  clientEmail?: string | null;
  clientNom?: string;
  estModele?: boolean;
  /** Nom du modèle (null pour un modèle d'avant la migration, à nommer). */
  nomModele?: string | null;
  /** Signature « Bon pour accord » enregistrée → devis figé. */
  signee?: boolean;
  /**
   * Motif de blocage du PDF (garde TVA). Non nul → le téléchargement
   * est remplacé par l'explication : la route répond 501, mais un
   * `<a download>` avale le corps de la réponse sur desktop.
   */
  pdfBloqueMotif?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const boutonPdf = pdfBloqueMotif ? (
    <Button
      variant="outline"
      onClick={() =>
        toast.error("PDF indisponible", { description: pdfBloqueMotif })
      }
    >
      <FileWarning className="size-4" />
      PDF indisponible
    </Button>
  ) : (
    // target=_blank : sur iOS (PWA), download seul échoue — le nouvel
    // onglet ouvre le visualiseur PDF natif.
    <Button variant="outline" asChild>
      <a
        href={`/api/devis/${devisId}/pdf`}
        download
        target="_blank"
        rel="noopener"
      >
        <Download className="size-4" />
        Télécharger PDF
      </a>
    </Button>
  );

  async function onRetirerDesModeles() {
    setPending("modele");
    const result = await setDevisModeleAction(devisId, false);
    setPending(null);
    if (result.ok) {
      toast.success(`${numero} retiré des modèles`, {
        description: "Il réapparaît dans la liste des devis.",
      });
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
        <NomModeleDialog
          trigger={
            <Button variant="outline">
              <Pencil className="size-4" />
              {nomModele ? "Renommer" : "Nommer ce modèle"}
            </Button>
          }
          titre={nomModele ? "Renommer le modèle" : "Nommer le modèle"}
          description="Le nom sert uniquement à retrouver le modèle : il n'apparaît sur aucun document."
          nomInitial={nomModele ?? ""}
          libelleValider={nomModele ? "Renommer" : "Nommer"}
          onValider={(nom) => renommerModeleDevisAction(devisId, nom)}
          messageSucces={(nom) => `Modèle renommé « ${nom} »`}
        />
        {boutonPdf}
        <Button
          variant="outline"
          onClick={onRetirerDesModeles}
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
      {boutonPdf}

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
          Refaire un devis similaire
        </Link>
      </Button>

      {/* Un devis signé ou converti est un document engageant : il ne
          part pas dans les modèles (où il sortirait des statistiques). */}
      {!signee && !factureId && (
        <NomModeleDialog
          trigger={
            <Button variant="outline">
              <Bookmark className="size-4" />
              Enregistrer comme modèle
            </Button>
          }
          titre="Enregistrer comme modèle"
          description={
            <>
              Le devis <span className="font-mono">{numero}</span> deviendra un
              modèle nommé : il quitte la liste des devis et les statistiques,
              et sert de point de départ à vos prochains devis.
            </>
          }
          libelleValider="Enregistrer"
          onValider={(nom) => setDevisModeleAction(devisId, true, nom)}
          messageSucces={(nom) => `Modèle « ${nom} » enregistré`}
        />
      )}

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

      {/* Acceptation cochée par erreur : retour possible tant que le
          devis n'est ni signé par le client ni converti en facture. */}
      {statut === "accepte" && !factureId && !signee && (
        <Button
          variant="outline"
          onClick={() => changeStatut("brouillon", "Repassé en brouillon")}
          disabled={pending === "brouillon"}
          title="Annule l'acceptation — possible tant que le devis n'est ni signé ni facturé"
        >
          <Undo2 className="size-4" />
          Repasser en brouillon
        </Button>
      )}
    </div>
  );
}
