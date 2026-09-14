"use client";

import Link from "next/link";
import { Bookmark, ChevronDown, FilePlus2 } from "lucide-react";

import { nomModeleAffiche, type ModeleNommable } from "@/lib/modeles-devis";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ModeleMenu = ModeleNommable & { id: string };

/**
 * Menu « Nouveau depuis un modèle » : liste les modèles PAR LEUR NOM ;
 * choisir un modèle ouvre le formulaire de nouveau devis pré-rempli
 * (?source=<id>, le même chemin que « Refaire un devis similaire »).
 * Rien n'est créé — et aucun numéro consommé — avant la validation.
 */
export function NouveauDepuisModeleMenu({
  modeles,
  size,
  className,
  libelle = "Nouveau depuis un modèle",
}: {
  modeles: ModeleMenu[];
  size?: ButtonProps["size"];
  className?: string;
  /** Texte du bouton (raccourci sur la barre mobile). */
  libelle?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className={className}>
          <Bookmark className="size-4" />
          {libelle}
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuLabel>Partir du modèle…</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {modeles.length === 0 ? (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Aucun modèle pour l&apos;instant. Ouvrez un devis puis
            « Enregistrer comme modèle ».
          </div>
        ) : (
          modeles.map((m) => (
            <DropdownMenuItem key={m.id} asChild>
              <Link href={`/devis/nouveau?source=${m.id}`}>
                <FilePlus2 className="text-muted-foreground" />
                <span className="truncate">{nomModeleAffiche(m)}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
