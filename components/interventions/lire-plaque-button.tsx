"use client";

import { useRef, useState } from "react";
import { Loader2, ScanText } from "lucide-react";
import { toast } from "sonner";

import { compressImage } from "@/lib/image-compress";
import { lirePlaque, type LecturePlaque } from "@/lib/plaque-signaletique";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ChampsPlaque = { marque: string; modele: string; numSerie: string; fluide: string; chargeKg: string };

/**
 * « Lire la plaque » : photo de la plaque signalétique → texte (OCR
 * Tesseract, chargé à la demande depuis un CDN, rien n'est envoyé à un
 * serveur) → marque, modèle, n° de série, fluide, charge proposés dans
 * un dialogue où l'on corrige avant d'appliquer au formulaire.
 */
export function LirePlaqueButton({ onAppliquer }: { onAppliquer: (champs: ChampsPlaque) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [lecture, setLecture] = useState<LecturePlaque | null>(null);
  const [champs, setChamps] = useState<ChampsPlaque>({ marque: "", modele: "", numSerie: "", fluide: "", chargeKg: "" });

  async function onFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setEnCours("Préparation de la photo…");
    try {
      // Résolution modérée : assez pour les caractères d'une plaque,
      // léger pour le moteur.
      const image = await compressImage(fichier, 1600);
      setEnCours("Chargement du moteur de lecture…");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setEnCours(`Lecture… ${Math.round(m.progress * 100)} %`);
          }
        },
      });
      try {
        const { data } = await worker.recognize(image);
        const r = lirePlaque(data.text ?? "");
        setLecture(r);
        setChamps({
          marque: r.marque ?? "",
          modele: r.modele ?? "",
          numSerie: r.numSerie ?? "",
          fluide: r.fluide ?? "",
          chargeKg: r.chargeKg !== null ? String(r.chargeKg) : "",
        });
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      toast.error("Lecture impossible", {
        description:
          err instanceof Error && /fetch|network|load/i.test(err.message)
            ? "Le moteur de lecture n'a pas pu être téléchargé (réseau)."
            : "Réessayez avec une photo nette, bien éclairée, plaque de face.",
      });
    } finally {
      setEnCours(null);
    }
  }

  function appliquer() {
    onAppliquer(champs);
    setLecture(null);
  }

  const maj = (k: keyof ChampsPlaque) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setChamps((c) => ({ ...c, [k]: e.target.value }));

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFichier} className="hidden" />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={enCours !== null}>
        {enCours ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}
        {enCours ?? "Lire la plaque"}
      </Button>

      <Dialog open={lecture !== null} onOpenChange={(o) => !o && setLecture(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plaque signalétique</DialogTitle>
            <DialogDescription>
              Vérifiez ce qui a été lu (l&apos;OCR confond parfois O et 0, I et 1), puis appliquez au formulaire.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Champ id="plaque-marque" label="Marque" value={champs.marque} onChange={maj("marque")} />
            <Champ id="plaque-modele" label="Modèle" value={champs.modele} onChange={maj("modele")} />
            <Champ id="plaque-serie" label="Numéro de série" value={champs.numSerie} onChange={maj("numSerie")} />
            <div className="grid grid-cols-2 gap-3">
              <Champ id="plaque-fluide" label="Fluide" value={champs.fluide} onChange={maj("fluide")} />
              <Champ id="plaque-charge" label="Charge (kg)" value={champs.chargeKg} onChange={maj("chargeKg")} inputMode="decimal" />
            </div>
            {lecture && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Texte lu sur la photo</summary>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2">{lecture.texte.trim() || "(rien)"}</pre>
              </details>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLecture(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={appliquer}>
              Appliquer au formulaire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Champ({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}
