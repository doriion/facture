"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Clock, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatDateFr } from "@/lib/format";
import {
  deleteTacheAction,
  setTacheFaitAction,
  type TacheAvecDetails,
} from "@/lib/actions/taches";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
 * Une ligne du pense-bête. Le bouton de gauche (44 px, taille pouce)
 * coche la tâche avec une petite animation ; un toast « Annuler »
 * reste affiché 6 secondes pour rattraper une fausse manip. Depuis la
 * vue « Faites », le même bouton décoche.
 */
export function TacheItem({
  tache,
  joursRetard,
}: {
  tache: TacheAvecDetails;
  joursRetard?: number;
}) {
  const [, startTransition] = useTransition();
  // Animation locale de validation, le temps que le serveur reclasse
  const [validee, setValidee] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const coche = tache.fait || validee;

  function basculer() {
    const cible = !tache.fait;
    if (cible) setValidee(true);
    startTransition(async () => {
      const res = await setTacheFaitAction(tache.id, cible);
      if (!res.ok) {
        setValidee(false);
        toast.error(res.error);
        return;
      }
      if (cible) {
        toast.success("Tâche faite", {
          description: tache.titre,
          duration: 6000,
          action: {
            label: "Annuler",
            onClick: () => {
              void setTacheFaitAction(tache.id, false);
            },
          },
        });
      }
    });
  }

  function supprimer() {
    startTransition(async () => {
      const res = await deleteTacheAction(tache.id);
      if (!res.ok) toast.error(res.error);
      else toast.success("Tâche supprimée");
    });
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border bg-card p-3 transition-all duration-300",
        coche && !tache.fait && "scale-[0.98] opacity-50",
      )}
    >
      <button
        type="button"
        onClick={basculer}
        aria-label={tache.fait ? "Marquer à refaire" : "Marquer comme faite"}
        className={cn(
          "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90",
          coche
            ? "border-green-600 bg-green-600 text-white"
            : "border-muted-foreground/40 text-transparent hover:border-green-600",
        )}
      >
        <Check
          className={cn(
            "size-6 transition-transform duration-200",
            coche ? "scale-100" : "scale-50",
          )}
          strokeWidth={3}
        />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "break-words text-sm font-medium leading-snug",
            coche && "line-through opacity-60",
          )}
        >
          {tache.titre}
        </p>
        {tache.notes && (
          <p className="mt-0.5 line-clamp-2 whitespace-pre-line break-words text-xs text-muted-foreground">
            {tache.notes}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {typeof joursRetard === "number" && joursRetard > 0 && (
            <Badge variant="destructive">
              {joursRetard} j de retard
            </Badge>
          )}
          {tache.date_echeance && !tache.fait && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                typeof joursRetard === "number" && joursRetard > 0
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              <Clock className="size-3" />
              {formatDateFr(tache.date_echeance)}
              {tache.heure ? ` à ${tache.heure}` : ""}
            </span>
          )}
          {tache.fait && tache.fait_le && (
            <span className="text-xs text-muted-foreground">
              faite le {formatDateFr(tache.fait_le.slice(0, 10))}
            </span>
          )}
          {tache.priorite === "urgente" && !tache.fait && (
            <Badge variant="warning">Urgent</Badge>
          )}
          {tache.lien && (
            <Link
              href={tache.lien.href}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Link2 className="size-3" />
              <span className="max-w-[180px] truncate">
                {tache.lien.label}
              </span>
            </Link>
          )}
        </div>
        {tache.photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tache.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setLightbox(photo.url)}
                className="size-14 overflow-hidden rounded-md border"
                aria-label="Voir la photo en grand"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase */}
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            aria-label="Supprimer la tâche"
            className="mt-1 rounded p-2 text-muted-foreground/50 transition-colors hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette tâche ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {tache.titre} »
              {tache.photos.length > 0 &&
                ` et ses ${tache.photos.length} photo(s)`}{" "}
              seront supprimées définitivement.
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

      <Dialog
        open={Boolean(lightbox)}
        onOpenChange={(o) => !o && setLightbox(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">Photo de la tâche</DialogTitle>
          {lightbox && (
            /* eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase */
            <img
              src={lightbox}
              alt=""
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
