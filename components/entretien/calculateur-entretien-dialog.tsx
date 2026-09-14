"use client";

import { useState, type ReactNode } from "react";
import { Calculator } from "lucide-react";

import type { BaremeEntretien, ResultatCalcul } from "@/lib/bareme-entretien";
import { CalculateurEntretien } from "@/components/entretien/calculateur-entretien";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Le calculateur en fenêtre, ouvert depuis un formulaire (devis,
 * contrat) : au clic sur le bouton de validation, `onValider` reçoit le
 * chiffrage et la fenêtre se ferme. Le formulaire hôte décide quoi en
 * faire (lignes de devis, redevance de contrat).
 */
export function CalculateurEntretienDialog({
  bareme,
  onValider,
  libelleValider,
  description,
  trigger,
}: {
  bareme: BaremeEntretien;
  onValider: (calcul: ResultatCalcul) => void;
  libelleValider: string;
  description: ReactNode;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline">
            <Calculator className="size-4" />
            Calculer un entretien
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Calculateur d&apos;entretien</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <CalculateurEntretien
          bareme={bareme}
          libelleValider={libelleValider}
          onValider={(calcul) => {
            onValider(calcul);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
