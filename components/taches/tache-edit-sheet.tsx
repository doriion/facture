"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Image as ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/image-compress";
import {
  deleteTachePhotoAction,
  updateTacheAction,
  uploadTachePhotoAction,
  type TacheAvecDetails,
} from "@/lib/actions/taches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * Tiroir d'édition d'une tâche existante (même gabarit du bas que la
 * saisie éclair). Titre, note, date + heure, priorité ; les photos se
 * gèrent en direct (ajout caméra/galerie, suppression) puisque la
 * tâche existe déjà en base. Le lien vers un document ne se modifie
 * pas ici — il se fixe à la création.
 */
export function TacheEditSheet({
  tache,
  open,
  onClose,
}: {
  tache: TacheAvecDetails;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [photoEnCours, setPhotoEnCours] = useState(false);

  const [titre, setTitre] = useState(tache.titre);
  const [notes, setNotes] = useState(tache.notes ?? "");
  const [date, setDate] = useState(tache.date_echeance ?? "");
  const [heure, setHeure] = useState(tache.heure ?? "");
  const [urgente, setUrgente] = useState(tache.priorite === "urgente");

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim() || pending) return;
    startTransition(async () => {
      const res = await updateTacheAction(tache.id, {
        titre,
        notes,
        date_echeance: date,
        heure,
        priorite: urgente ? "urgente" : "normale",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Tâche modifiée");
      onClose();
      router.refresh();
    });
  }

  async function ajouterFichiers(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoEnCours(true);
    let echecs = 0;
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await uploadTachePhotoAction(tache.id, fd);
      if (!res.ok) echecs += 1;
    }
    setPhotoEnCours(false);
    if (echecs > 0) toast.error(`${echecs} photo(s) n'ont pas pu être envoyées.`);
    router.refresh();
  }

  function supprimerPhoto(photoId: string) {
    startTransition(async () => {
      const res = await deleteTachePhotoAction(photoId);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-0 p-4 pt-5">
        <SheetTitle className="mb-3">Modifier la tâche</SheetTitle>
        <form
          onSubmit={enregistrer}
          className="flex flex-col gap-3 overflow-y-auto"
        >
          <Input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            maxLength={300}
            className="h-12 text-base"
            aria-label="Titre"
          />

          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="tache-edit-date" className="text-xs">
                Échéance
              </Label>
              <Input
                id="tache-edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
              />
            </div>
            {date && (
              <div className="space-y-1">
                <Label htmlFor="tache-edit-heure" className="text-xs">
                  Heure
                </Label>
                <Input
                  id="tache-edit-heure"
                  type="time"
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                  className="w-28"
                />
              </div>
            )}
            {date && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDate("");
                  setHeure("");
                }}
              >
                <X className="size-4" />
                Sans date
              </Button>
            )}
            <button
              type="button"
              onClick={() => setUrgente((u) => !u)}
              className={cn(
                "mb-0.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                urgente
                  ? "border-amber-500 bg-amber-500/15 font-medium text-amber-700 dark:text-amber-300"
                  : "hover:bg-accent",
              )}
            >
              Urgent
            </button>
          </div>

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note (optionnelle)"
            rows={2}
            maxLength={2000}
          />

          {/* Photos : gestion en direct sur la tâche existante */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void ajouterFichiers(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void ajouterFichiers(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={photoEnCours}
              onClick={() => cameraInputRef.current?.click()}
            >
              {photoEnCours ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={photoEnCours}
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImageIcon className="size-4" />
              Galerie
            </Button>
            {tache.photos.map((photo) => (
              <div key={photo.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase */}
                <img
                  src={photo.url}
                  alt=""
                  className="size-16 rounded-md border object-cover"
                />
                <button
                  type="button"
                  aria-label="Supprimer cette photo"
                  onClick={() => supprimerPhoto(photo.id)}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={!titre.trim() || pending}
            className="mt-1"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
