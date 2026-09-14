"use client";

import { useEffect, useState } from "react";

/** Chemin du logo dans `public/`. */
const CHEMIN_LOGO = "/logo.png";

/**
 * Marque de l'application, utilisée dans la barre latérale, la barre
 * du haut et le menu mobile — trois endroits qui portaient chacun leur
 * propre carré « F » recopié.
 *
 * Affiche le logo déposé dans `public/logo.png` s'il existe, et retombe
 * sinon sur le monogramme. Ce repli n'est pas une précaution
 * théorique : il permet de livrer la charte graphique avant que le
 * fichier image ne soit dans le dépôt, et évite un carré cassé si le
 * fichier est un jour renommé ou supprimé.
 *
 * POURQUOI UN PRÉCHARGEMENT PLUTÔT QU'UN `onError` SUR LA BALISE.
 * Un `<img>` rendu côté serveur déclenche son erreur de chargement
 * AVANT que React ne s'attache au DOM : le gestionnaire n'était jamais
 * appelé et l'icône d'image cassée restait affichée (constaté en
 * capture avant correction). On part donc du monogramme, et on ne
 * bascule sur le logo qu'une fois son chargement réellement confirmé.
 *
 * Le logo est décoratif : le nom « Facture AE » l'accompagne toujours
 * en toutes lettres, d'où l'alternative textuelle vide plutôt qu'une
 * description qui serait lue deux fois.
 */
export function LogoMarque({ taille = 32 }: { taille?: number }) {
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let vivant = true;
    const img = new window.Image();
    img.onload = () => {
      if (vivant) setCharge(true);
    };
    img.src = CHEMIN_LOGO;
    return () => {
      vivant = false;
    };
  }, []);

  if (!charge) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground"
        style={{ height: taille, width: taille, fontSize: taille * 0.45 }}
        aria-hidden
      >
        F
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- chargement vérifié à la main
    <img
      src={CHEMIN_LOGO}
      alt=""
      width={taille}
      height={taille}
      className="shrink-0 rounded-md object-contain"
      style={{ height: taille, width: taille }}
    />
  );
}
