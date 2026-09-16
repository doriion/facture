"use client";

import { useRef } from "react";

/**
 * Swipe horizontal au doigt (jour / semaine / mois précédent ou
 * suivant). Touch uniquement : à la souris, le clic-glisser vertical de
 * la grille garde son rôle. Un mouvement est un swipe s'il fait au moins
 * 60 px, nettement plus horizontal que vertical, en moins d'une seconde.
 * Vers la gauche = suivant (sens 1), vers la droite = précédent (-1).
 */
export function useGlissement(onGlisser: (sens: 1 | -1) => void) {
  const depart = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    depart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const d = depart.current;
    depart.current = null;
    const t = e.changedTouches[0];
    if (!d || !t) return;
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (Date.now() - d.t > 1000) return;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // Un swipe traité ici ne doit pas aussi faire glisser le conteneur
    // parent (bandeau des jours dans la vue jour, par exemple).
    e.stopPropagation();
    onGlisser(dx < 0 ? 1 : -1);
  };

  return { onTouchStart, onTouchEnd };
}
