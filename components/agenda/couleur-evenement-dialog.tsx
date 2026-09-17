"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { setCouleurEvenementAction } from "@/lib/actions/agenda-couleurs";
import { SelecteurCouleur } from "@/components/agenda/selecteur-couleur";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Couleur d'UN évènement précis (prime sur celle de son type) — pour
 * mettre en évidence un rendez-vous important. « Couleur du type »
 * retire la couleur propre.
 */
export function CouleurEvenementDialog({
  cible,
  onClose,
  onOptimiste,
}: {
  /** Évènement visé, null = fermé. */
  cible: {
    cle: string;
    libelle: string;
    couleurActuelle: string;
    couleurDuType: string;
    aCouleurPropre: boolean;
  } | null;
  onClose: () => void;
  /** Affiche la couleur tout de suite (le serveur confirme derrière). */
  onOptimiste?: (cle: string, hex: string | null) => () => void;
}) {
  const router = useRouter();
  const [couleur, setCouleur] = useState("#dbeafe");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (cible) setCouleur(cible.couleurActuelle);
  }, [cible]);

  async function appliquer(hex: string | null) {
    if (!cible) return;
    setPending(true);
    const annuler = onOptimiste?.(cible.cle, hex);
    onClose();
    const res = await setCouleurEvenementAction(cible.cle, hex);
    setPending(false);
    if (!res.ok) {
      annuler?.();
      toast.error("Erreur", { description: res.error });
      return;
    }
    toast.success(hex ? "Couleur de l'évènement enregistrée" : "Couleur du type rétablie");
    router.refresh();
  }

  return (
    <Dialog open={!!cible} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Couleur de cet évènement</DialogTitle>
          <DialogDescription className="truncate">{cible?.libelle}</DialogDescription>
        </DialogHeader>
        {cible && (
          <SelecteurCouleur
            valeur={couleur}
            onChange={setCouleur}
            nom="cet évènement"
            apercu={cible.libelle}
          />
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending || !cible?.aCouleurPropre}
            onClick={() => appliquer(null)}
          >
            <RotateCcw className="size-4" />
            Couleur du type
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Annuler
            </Button>
            <Button type="button" onClick={() => appliquer(couleur)} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Appliquer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
