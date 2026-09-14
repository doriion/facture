"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { NOM_MODELE_MAX, normaliserNomModele } from "@/lib/modeles-devis";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Dialogue « nom du modèle », partagé par l'enregistrement d'un devis
 * comme modèle et par le renommage d'un modèle existant. La validation
 * (vide, longueur) est celle de lib/modeles-devis, côté client pour le
 * retour immédiat ET côté serveur dans l'action.
 */
export function NomModeleDialog({
  trigger,
  titre,
  description,
  nomInitial = "",
  libelleValider,
  onValider,
  messageSucces,
}: {
  trigger: ReactNode;
  titre: string;
  description?: ReactNode;
  nomInitial?: string;
  libelleValider: string;
  /** Action serveur ; `ok: false` affiche l'erreur sans fermer. */
  onValider: (
    nom: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Toast affiché après succès, à partir du nom normalisé. */
  messageSucces: (nom: string) => string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState(nomInitial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function ouvrir(next: boolean) {
    if (next) {
      setNom(nomInitial);
      setErreur(null);
    }
    setOpen(next);
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    const r = normaliserNomModele(nom);
    if (!r.ok) {
      setErreur(r.error);
      return;
    }
    setPending(true);
    const result = await onValider(r.nom);
    setPending(false);
    if (result.ok) {
      setOpen(false);
      toast.success(messageSucces(r.nom));
      router.refresh();
    } else {
      setErreur(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={ouvrir}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {/* Un seul champ : Entrée valide, Échap ferme. */}
        <form onSubmit={valider} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{titre}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="nom_modele">Nom du modèle</Label>
            <Input
              id="nom_modele"
              value={nom}
              onChange={(e) => {
                setNom(e.target.value);
                setErreur(null);
              }}
              placeholder="ex. Pose monosplit, Entretien PAC…"
              maxLength={NOM_MODELE_MAX}
              autoFocus
              autoComplete="off"
              aria-invalid={erreur ? true : undefined}
            />
            {erreur && (
              <p className="text-xs text-destructive" role="alert">
                {erreur}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {libelleValider}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
