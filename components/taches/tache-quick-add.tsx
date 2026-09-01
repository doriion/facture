"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Image as ImageIcon,
  Link2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/image-compress";
import { formatDateFr } from "@/lib/format";
import {
  aujourdhuiParis,
  dateRaccourci,
  type RaccourciDate,
} from "@/lib/taches-logic";
import {
  createTacheAction,
  uploadTachePhotoAction,
} from "@/lib/actions/taches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/** Lien pré-rempli quand on arrive depuis une fiche (« Ajouter une tâche »). */
export type PrefillTache = {
  titre?: string;
  lienLabel?: string;
  client_id?: string;
  intervention_id?: string;
  devis_id?: string;
  facture_id?: string;
};

type PhotoEnAttente = { file: File; apercu: string };

/**
 * Saisie éclair : bouton flottant « + » (mobile) / bouton « Nouvelle
 * tâche » (desktop) ouvrant un tiroir du bas. Un titre + Entrée
 * suffisent ; date (raccourcis), heure, urgence, note, photos et lien
 * sont optionnels. Les photos sont compressées côté client puis
 * uploadées APRÈS la création de la tâche.
 */
export function TacheQuickAdd({
  prefill,
  ouvrirAuChargement = false,
}: {
  prefill?: PrefillTache;
  ouvrirAuChargement?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(ouvrirAuChargement);
  const [pending, startTransition] = useTransition();

  const [titre, setTitre] = useState(prefill?.titre ?? "");
  const [notes, setNotes] = useState("");
  const [notesVisibles, setNotesVisibles] = useState(false);
  const [date, setDate] = useState("");
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [heure, setHeure] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [photos, setPhotos] = useState<PhotoEnAttente[]>([]);
  const [lienActif, setLienActif] = useState(Boolean(prefill?.lienLabel));

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const today = aujourdhuiParis();
  const raccourcis: Array<{ id: RaccourciDate; label: string }> = [
    { id: "aujourdhui", label: "Aujourd'hui" },
    { id: "demain", label: "Demain" },
    { id: "semaine", label: "Cette semaine" },
  ];

  function ajouterFichiers(files: FileList | null) {
    if (!files) return;
    const nouvelles = Array.from(files).map((file) => ({
      file,
      apercu: URL.createObjectURL(file),
    }));
    setPhotos((p) => [...p, ...nouvelles]);
  }

  function retirerPhoto(index: number) {
    setPhotos((p) => {
      URL.revokeObjectURL(p[index]!.apercu);
      return p.filter((_, i) => i !== index);
    });
  }

  function reinitialiser() {
    setTitre("");
    setNotes("");
    setNotesVisibles(false);
    setDate("");
    setDatePickerVisible(false);
    setHeure("");
    setUrgente(false);
    photos.forEach((p) => URL.revokeObjectURL(p.apercu));
    setPhotos([]);
  }

  function fermer() {
    setOpen(false);
    // Nettoie ?ajouter=1&… pour ne pas rouvrir le tiroir au refresh
    if (ouvrirAuChargement) router.replace("/taches");
  }

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!titre.trim() || pending) return;

    startTransition(async () => {
      const res = await createTacheAction({
        titre,
        notes,
        date_echeance: date,
        heure,
        priorite: urgente ? "urgente" : "normale",
        client_id: lienActif ? (prefill?.client_id ?? "") : "",
        intervention_id: lienActif ? (prefill?.intervention_id ?? "") : "",
        devis_id: lienActif ? (prefill?.devis_id ?? "") : "",
        facture_id: lienActif ? (prefill?.facture_id ?? "") : "",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      let echecsPhotos = 0;
      for (const photo of photos) {
        const compressed = await compressImage(photo.file);
        const fd = new FormData();
        fd.append("file", compressed);
        const up = await uploadTachePhotoAction(res.data.id, fd);
        if (!up.ok) echecsPhotos += 1;
      }

      if (echecsPhotos > 0) {
        toast.warning(
          `Tâche ajoutée, mais ${echecsPhotos} photo(s) n'ont pas pu être envoyées.`,
        );
      } else {
        toast.success("Tâche ajoutée", { description: titre.trim() });
      }
      reinitialiser();
      fermer();
      router.refresh();
    });
  }

  return (
    <>
      {/* Déclencheur desktop */}
      <Button className="max-md:hidden" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nouvelle tâche
      </Button>

      {/* Bouton flottant mobile, au-dessus de la safe-area */}
      <button
        type="button"
        aria-label="Ajouter une tâche"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-90 md:hidden"
      >
        <Plus className="size-7" />
      </button>

      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : fermer())}>
        <SheetContent side="bottom" className="gap-0 p-4 pt-5">
          <SheetTitle className="mb-3">Nouvelle tâche</SheetTitle>
          <form
            onSubmit={soumettre}
            className="flex flex-col gap-3 overflow-y-auto"
          >
            <Input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex. : racheter du cuivre Ø16"
              autoFocus
              enterKeyHint="done"
              maxLength={300}
              className="h-12 text-base"
            />

            {/* Raccourcis de date */}
            <div className="flex flex-wrap items-center gap-1.5">
              {raccourcis.map((r) => {
                const valeur = dateRaccourci(r.id, today);
                const actif = date === valeur;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setDate(actif ? "" : valeur);
                      setDatePickerVisible(false);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      actif
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    {r.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setDatePickerVisible((v) => !v)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  datePickerVisible ||
                    (date &&
                      !raccourcis.some((r) => dateRaccourci(r.id, today) === date))
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                {date &&
                !raccourcis.some((r) => dateRaccourci(r.id, today) === date)
                  ? formatDateFr(date)
                  : "Choisir…"}
              </button>
              {date && (
                <button
                  type="button"
                  aria-label="Retirer la date"
                  onClick={() => {
                    setDate("");
                    setHeure("");
                    setDatePickerVisible(false);
                  }}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {(datePickerVisible || date) && (
              <div className="flex gap-2">
                {datePickerVisible && (
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex-1"
                  />
                )}
                {date && (
                  <Input
                    type="time"
                    value={heure}
                    onChange={(e) => setHeure(e.target.value)}
                    aria-label="Heure (optionnelle)"
                    className="w-32"
                  />
                )}
              </div>
            )}

            {/* Photos + options sur une même rangée */}
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  ajouterFichiers(e.target.files);
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
                  ajouterFichiers(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="size-4" />
                Photo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImageIcon className="size-4" />
                Galerie
              </Button>
              <button
                type="button"
                onClick={() => setUrgente((u) => !u)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  urgente
                    ? "border-amber-500 bg-amber-500/15 font-medium text-amber-700 dark:text-amber-300"
                    : "hover:bg-accent",
                )}
              >
                Urgent
              </button>
              {!notesVisibles && (
                <button
                  type="button"
                  onClick={() => setNotesVisibles(true)}
                  className="rounded-full border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  + Note
                </button>
              )}
            </div>

            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, i) => (
                  <div key={photo.apercu} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (object URL) */}
                    <img
                      src={photo.apercu}
                      alt=""
                      className="size-16 rounded-md border object-cover"
                    />
                    <button
                      type="button"
                      aria-label="Retirer cette photo"
                      onClick={() => retirerPhoto(i)}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {notesVisibles && (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note (optionnelle)"
                rows={2}
                maxLength={2000}
              />
            )}

            {prefill?.lienLabel && lienActif && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Link2 className="size-4 shrink-0" />
                <span className="truncate">Liée à : {prefill.lienLabel}</span>
                <button
                  type="button"
                  aria-label="Retirer le lien"
                  onClick={() => setLienActif(false)}
                  className="rounded-full p-1 hover:bg-accent"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={!titre.trim() || pending}
              className="mt-1"
            >
              {pending ? "Ajout…" : "Ajouter"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
