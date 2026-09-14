"use client";

import { useState } from "react";

/**
 * Marque de l'application, utilisée dans la barre latérale, la barre
 * du haut et le menu mobile — trois endroits qui portaient chacun leur
 * propre carré « F » recopié.
 *
 * Affiche le logo déposé dans `public/logo.png` s'il existe, et retombe
 * sinon sur le monogramme. Ce repli n'est pas une précaution
 * théorique : il permet de livrer la charte graphique avant que le
 * fichier image ne soit dans le dépôt, et évite un carré vide si le
 * fichier est un jour renommé ou supprimé.
 *
 * Le logo est décoratif : le nom « Facture AE » l'accompagne toujours
 * en toutes lettres, d'où l'alternative textuelle vide plutôt qu'une
 * description qui serait lue deux fois.
 */
export function LogoMarque({ taille = 32 }: { taille?: number }) {
  const [echec, setEchec] = useState(false);

  if (echec) {
    return (
      <div
        className="flex items-center justify-center rounded-md bg-primary font-bold text-primary-foreground"
        style={{ height: taille, width: taille, fontSize: taille * 0.45 }}
        aria-hidden
      >
        F
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- repli onError
    <img
      src="/logo.png"
      alt=""
      width={taille}
      height={taille}
      className="rounded-md object-contain"
      style={{ height: taille, width: taille }}
      onError={() => setEchec(true)}
    />
  );
}
