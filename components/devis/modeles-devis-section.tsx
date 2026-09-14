"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  BookmarkMinus,
  ExternalLink,
  FilePlus2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteDevisAction,
  renommerModeleDevisAction,
  setDevisModeleAction,
} from "@/lib/actions/devis";
import { formatEuros } from "@/lib/format";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";
import { modeleSansNom, nomModeleAffiche } from "@/lib/modeles-devis";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ModeleDevisListe = {
  id: string;
  numero: string;
  nom_modele: string | null;
  statut: string;
  type_activite: string;
  total_ht: number | string;
};

/**
 * Section « Mes modèles » de la page /devis : la liste des modèles par
 * nom, avec pour chacun « Créer un devis », « Renommer », et dans le
 * menu « Ouvrir », « Retirer des modèles », « Supprimer ».
 *
 * Suppression : réservée aux modèles encore en brouillon (même règle
 * que deleteDevisAction). Un devis qui avait été envoyé avant de
 * devenir modèle est un document émis : il se RETIRE des modèles (il
 * réapparaît dans la liste), il ne se supprime pas.
 */
export function ModelesDevisSection({
  modeles,
}: {
  modeles: ModeleDevisListe[];
}) {
  if (modeles.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bookmark className="size-4 text-primary" />
          Mes modèles
          <span className="text-sm font-normal text-muted-foreground">
            ({modeles.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="divide-y rounded-md border">
          {modeles.map((m) => (
            <LigneModele key={m.id} modele={m} />
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Les modèles n&apos;apparaissent ni dans la liste ci-dessous, ni
          dans les statistiques. Pour en ajouter un : ouvrez un devis puis
          « Enregistrer comme modèle ».
        </p>
      </CardContent>
    </Card>
  );
}

function LigneModele({ modele }: { modele: ModeleDevisListe }) {
  const router = useRouter();
  const [pending, setPending] = useState<"retirer" | "supprimer" | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const nom = nomModeleAffiche(modele);
  const sansNom = modeleSansNom(modele);
  const supprimable = modele.statut === "brouillon";

  async function retirer() {
    setPending("retirer");
    const result = await setDevisModeleAction(modele.id, false);
    setPending(null);
    if (result.ok) {
      toast.success(`${nom} retiré des modèles`, {
        description: `Le devis ${modele.numero} réapparaît dans la liste des devis.`,
      });
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function supprimer() {
    setPending("supprimer");
    const result = await deleteDevisAction(modele.id);
    setPending(null);
    setConfirmerSuppression(false);
    if (result.ok) {
      toast.success(`Modèle « ${nom} » supprimé`);
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  return (
    // Mobile : nom sur sa ligne, actions dessous en pleine largeur (sinon
    // le nom se tronque à trois lettres). Desktop : une seule ligne.
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {nom}
          {sansNom && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              à nommer
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{modele.numero}</span>
          {" · "}
          {LABELS_TYPE_ACTIVITE[
            modele.type_activite as keyof typeof LABELS_TYPE_ACTIVITE
          ] ?? modele.type_activite}
          {" · "}
          {formatEuros(Number(modele.total_ht))}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" asChild className="max-sm:flex-1">
          <Link href={`/devis/nouveau?source=${modele.id}`}>
            <FilePlus2 className="size-4" />
            Créer un devis
          </Link>
        </Button>

        <NomModeleDialog
          trigger={
            <Button
              size="sm"
              variant="outline"
              title={`Renommer « ${nom} »`}
            >
              <Pencil className="size-4" />
              <span className="max-sm:sr-only">Renommer</span>
            </Button>
          }
          titre="Renommer le modèle"
          description={
            <>
              Devis <span className="font-mono">{modele.numero}</span>. Le nom
              sert uniquement à retrouver le modèle : il n&apos;apparaît sur
              aucun document.
            </>
          }
          nomInitial={modele.nom_modele ?? ""}
          libelleValider="Renommer"
          onValider={(nouveau) => renommerModeleDevisAction(modele.id, nouveau)}
          messageSucces={(nouveau) => `Modèle renommé « ${nouveau} »`}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              title="Plus d'actions"
              disabled={pending !== null}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MoreHorizontal className="size-4" />
              )}
              <span className="sr-only">Plus d&apos;actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/devis/${modele.id}`}>
                <ExternalLink className="text-muted-foreground" />
                Ouvrir le modèle
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={retirer}>
              <BookmarkMinus className="text-muted-foreground" />
              Retirer des modèles
            </DropdownMenuItem>
            {supprimable && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setConfirmerSuppression(true)}
                >
                  <Trash2 />
                  Supprimer
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog
        open={confirmerSuppression}
        onOpenChange={setConfirmerSuppression}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le modèle « {nom} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le devis <strong>{modele.numero}</strong> et ses lignes seront
              supprimés définitivement. Les devis déjà créés depuis ce
              modèle ne sont pas concernés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                supprimer();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending === "supprimer"}
            >
              {pending === "supprimer" && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
