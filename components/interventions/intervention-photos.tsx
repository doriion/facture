"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Images, Loader2, ScanText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  uploadInterventionPhotoAction,
  deleteInterventionPhotoAction,
  type InterventionPhoto,
} from "@/lib/actions/intervention-photos";
import { compressImage } from "@/lib/image-compress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const MOMENT_LABELS: Record<string, string> = {
  avant: "Avant",
  pendant: "Pendant",
  apres: "Après",
  autre: "Autre",
};

export function InterventionPhotos({
  interventionId,
  photos,
}: {
  interventionId: string;
  photos: InterventionPhoto[];
}) {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [moment, setMoment] = useState<string>("apres");
  const [legende, setLegende] = useState("");
  const [pending, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState<InterventionPhoto | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let success = 0;
    let failed = 0;
    for (const file of Array.from(files)) {
      // Compression côté client (max ~1600 px, JPEG) : une photo de
      // téléphone passe de plusieurs Mo à quelques centaines de Ko.
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("moment", moment);
      fd.append("legende", legende);
      const res = await uploadInterventionPhotoAction(interventionId, fd);
      if (res.ok) success++;
      else {
        failed++;
        toast.error(`Échec ${file.name}`, { description: res.error });
      }
    }
    setUploading(false);
    setLegende("");
    if (success > 0) {
      toast.success(`${success} photo${success > 1 ? "s" : ""} ajoutée${success > 1 ? "s" : ""}`);
      router.refresh();
    }
    if (failed > 0 && success === 0) {
      // Erreurs déjà affichées
    }
  }

  function handleDelete(photoId: string) {
    startTransition(async () => {
      const res = await deleteInterventionPhotoAction(photoId);
      if (res.ok) {
        toast.success("Photo supprimée");
        router.refresh();
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="size-4 text-primary" />
          Photos du chantier
          {photos.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              ({photos.length})
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Preuves de travail utiles pour la décennale, le suivi client et la
          déclaration F-Gas. Max 10 Mo par photo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Zone d'upload */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="photo_moment" className="text-xs">
              Moment
            </Label>
            <Select value={moment} onValueChange={setMoment}>
              <SelectTrigger id="photo_moment" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MOMENT_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="photo_legende" className="text-xs">
              Légende (optionnelle)
            </Label>
            <Input
              id="photo_legende"
              value={legende}
              onChange={(e) => setLegende(e.target.value)}
              placeholder="Ex : Tableau électrique avant pose"
              className="h-9"
            />
          </div>
        </div>

        {/* Caméra (une photo, capture directe) et galerie (multiple)
            séparées : sur mobile, « Prendre une photo » ouvre
            directement l'appareil, « Galerie » le sélecteur. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
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
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            {uploading ? "Envoi en cours…" : "Prendre une photo"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading}
          >
            <Images className="size-4" />
            Galerie
          </Button>
          {/* Emplacement réservé : lecture de la plaque signalétique
              (OCR) — fonctionnalité à venir, volontairement inactive. */}
          <Button
            type="button"
            variant="outline"
            disabled
            title="Bientôt : lire marque, modèle et n° de série depuis une photo de la plaque"
          >
            <ScanText className="size-4" />
            Lire la plaque (bientôt)
          </Button>
        </div>

        {/* Galerie */}
        {photos.length === 0 ? (
          <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            Aucune photo. Capturez avant/pendant/après le chantier.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
              >
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={photo.legende ?? "Photo intervention"}
                    className="size-full cursor-pointer object-cover transition-opacity hover:opacity-90"
                    loading="lazy"
                    onClick={() => setLightbox(photo)}
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                    URL expirée
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] text-white">
                  <span className="font-medium uppercase tracking-wide">
                    {MOMENT_LABELS[photo.moment ?? "autre"]}
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        title="Supprimer la photo"
                        className="rounded-full bg-black/40 p-1 opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                        disabled={pending}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette photo ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Action irréversible. La photo sera retirée du stockage.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(photo.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {photo.legende && (
                  <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-2 py-1 text-[10px] text-white">
                    <span className="line-clamp-1">{photo.legende}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        <Dialog
          open={Boolean(lightbox)}
          onOpenChange={(o) => !o && setLightbox(null)}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {lightbox?.legende ||
                  MOMENT_LABELS[lightbox?.moment ?? "autre"]}
              </DialogTitle>
              {lightbox?.legende && (
                <DialogDescription>
                  {MOMENT_LABELS[lightbox.moment ?? "autre"]}
                </DialogDescription>
              )}
            </DialogHeader>
            {lightbox?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt={lightbox.legende ?? ""}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

