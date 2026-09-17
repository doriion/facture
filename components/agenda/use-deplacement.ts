"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Glisser-déposer d'un évènement de l'agenda.
 *
 * À la souris : on appuie sur le créneau et on le tire (au-delà de 6 px,
 * c'est un déplacement ; en deçà, c'est un clic qui ouvre la fiche).
 * Au doigt : appui long (350 ms sans bouger), une petite vibration, puis
 * on glisse ; un doigt qui bouge tout de suite fait défiler la page
 * comme d'habitude. Appui long relâché sur place = menu (onAppuiLong). Pendant le glissement, le défilement est bloqué
 * (touchmove non passif) et la page défile seule près des bords.
 *
 * Le hook ne connaît pas la grille : `resoudre` transforme la position
 * du pointeur en cible (jour, heure…), stockée dans `enCours.cible` pour
 * dessiner le fantôme ; `onDeposer` reçoit la cible finale. L'élément
 * qui porte `poignee(e)` doit avoir la classe `poignee-deplacement`
 * (pas de sélection de texte ni de bulle iOS pendant l'appui long).
 */

const SEUIL_SOURIS_PX = 6;
const SEUIL_DOIGT_PX = 10;
const DELAI_APPUI_LONG_MS = 350;
const BORD_DEFILEMENT_PX = 72;
const PAS_DEFILEMENT_PX = 10;

export type PointDeplacement = {
  /** Position du pointeur (coordonnées écran). */
  x: number;
  y: number;
  /** Décalage entre le pointeur et le haut du créneau saisi (px). */
  decalageY: number;
};

export type DeplacementEnCours<T, C> = { e: T; cible: C | null; point: PointDeplacement };

type Saisie<T> = {
  e: T;
  x: number;
  y: number;
  decalageY: number;
  pointerId: number;
  cible: HTMLElement;
  tactile: boolean;
  minuteur: number | null;
};

export function useDeplacement<T, C>({
  resoudre,
  onDeposer,
  onAppuiLong,
  immediat,
  desactive = false,
}: {
  resoudre: (e: T, point: PointDeplacement) => C | null;
  onDeposer: (e: T, cible: C) => void;
  /**
   * Appui long relâché SANS bouger (au doigt) : l'utilisateur voulait
   * le menu de l'évènement, pas le déplacer.
   */
  onAppuiLong?: (e: T) => void;
  /**
   * Vrai pour un évènement en MODE RÉGLAGE : au doigt, il se déplace dès
   * le premier mouvement, sans appui long (son élément a touch-action:
   * none, le défilement n'entre pas en concurrence).
   */
  immediat?: (e: T) => boolean;
  /** Vrai pour ne rien saisir (évènement non déplaçable). */
  desactive?: boolean;
}) {
  const [enCours, setEnCours] = useState<DeplacementEnCours<T, C> | null>(null);
  const saisie = useRef<Saisie<T> | null>(null);
  const actif = useRef(false);
  // Un clic suit toujours le relâchement : après un glissement, on
  // l'avale pour ne pas ouvrir la fiche en plus.
  const clicAAvaler = useRef(false);
  const dernierPoint = useRef<{ x: number; y: number } | null>(null);

  const terminer = useCallback(() => {
    const s = saisie.current;
    if (s?.minuteur) window.clearTimeout(s.minuteur);
    if (s && s.cible.hasPointerCapture(s.pointerId)) {
      s.cible.releasePointerCapture(s.pointerId);
    }
    saisie.current = null;
    actif.current = false;
    dernierPoint.current = null;
    setEnCours(null);
  }, []);

  const demarrer = useCallback(
    (s: Saisie<T>) => {
      actif.current = true;
      // Une sélection de texte commencée pendant l'appui long (iOS)
      // gênerait le glissement : on l'efface.
      try {
        window.getSelection()?.removeAllRanges();
      } catch {}
      if (s.tactile && typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(10);
        } catch {}
      }
      const point = { x: s.x, y: s.y, decalageY: s.decalageY };
      dernierPoint.current = { x: s.x, y: s.y };
      setEnCours({ e: s.e, cible: resoudre(s.e, point), point });
    },
    [resoudre],
  );

  // Pendant un glissement au doigt, le navigateur ne doit pas défiler
  // (les écouteurs React sont passifs : il faut le natif), ni
  // commencer une sélection de texte pendant l'appui long.
  useEffect(() => {
    const bloquer = (ev: TouchEvent) => {
      if (actif.current && ev.cancelable) ev.preventDefault();
    };
    const bloquerSelection = (ev: Event) => {
      if (saisie.current || actif.current) ev.preventDefault();
    };
    document.addEventListener("touchmove", bloquer, { passive: false });
    document.addEventListener("selectstart", bloquerSelection);
    return () => {
      document.removeEventListener("touchmove", bloquer);
      document.removeEventListener("selectstart", bloquerSelection);
    };
  }, []);

  // Défilement automatique près des bords de l'écran (une boucle par
  // glissement, pas une par mouvement).
  const glissementAffiche = enCours !== null;
  useEffect(() => {
    if (!glissementAffiche) return;
    let cadre = 0;
    const boucle = () => {
      const p = dernierPoint.current;
      if (p) {
        if (p.y < BORD_DEFILEMENT_PX) window.scrollBy(0, -PAS_DEFILEMENT_PX);
        else if (p.y > window.innerHeight - BORD_DEFILEMENT_PX) window.scrollBy(0, PAS_DEFILEMENT_PX);
      }
      cadre = window.requestAnimationFrame(boucle);
    };
    cadre = window.requestAnimationFrame(boucle);
    return () => window.cancelAnimationFrame(cadre);
  }, [glissementAffiche]);

  useEffect(() => terminer, [terminer]);

  const poignee = (e: T) => ({
    onPointerDown: (ev: React.PointerEvent<HTMLElement>) => {
      if (desactive || ev.button !== 0 || saisie.current) return;
      // « tactile » = il faut un appui long avant de glisser. En mode
      // réglage, le doigt se comporte comme une souris.
      const tactile = ev.pointerType !== "mouse" && !(immediat?.(e) ?? false);
      const rect = ev.currentTarget.getBoundingClientRect();
      const s: Saisie<T> = {
        e,
        x: ev.clientX,
        y: ev.clientY,
        decalageY: ev.clientY - rect.top,
        pointerId: ev.pointerId,
        cible: ev.currentTarget,
        tactile,
        minuteur: null,
      };
      ev.currentTarget.setPointerCapture(ev.pointerId);
      if (tactile) {
        s.minuteur = window.setTimeout(() => {
          s.minuteur = null;
          if (saisie.current === s) demarrer(s);
        }, DELAI_APPUI_LONG_MS);
      }
      saisie.current = s;
    },
    onPointerMove: (ev: React.PointerEvent<HTMLElement>) => {
      const s = saisie.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (actif.current) {
        const point = { x: ev.clientX, y: ev.clientY, decalageY: s.decalageY };
        dernierPoint.current = { x: ev.clientX, y: ev.clientY };
        setEnCours({ e: s.e, cible: resoudre(s.e, point), point });
        return;
      }
      const distance = Math.hypot(ev.clientX - s.x, ev.clientY - s.y);
      if (s.tactile) {
        // Le doigt bouge avant l'appui long : c'est un défilement.
        if (distance > SEUIL_DOIGT_PX) terminer();
      } else if (distance > SEUIL_SOURIS_PX) {
        demarrer(s);
      }
    },
    onPointerUp: (ev: React.PointerEvent<HTMLElement>) => {
      const s = saisie.current;
      if (!s || ev.pointerId !== s.pointerId) return;
      if (actif.current) {
        const point = { x: ev.clientX, y: ev.clientY, decalageY: s.decalageY };
        const cible = resoudre(s.e, point);
        const immobile = Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < SEUIL_DOIGT_PX;
        // Après un glissement au doigt, le navigateur n'envoie pas
        // toujours de clic : on n'avale que celui qui suit tout de suite.
        clicAAvaler.current = true;
        window.setTimeout(() => {
          clicAAvaler.current = false;
        }, 150);
        terminer();
        if (s.tactile && immobile) onAppuiLong?.(s.e);
        else if (cible !== null) onDeposer(s.e, cible);
        return;
      }
      terminer();
    },
    onPointerCancel: () => terminer(),
    onClickCapture: (ev: React.MouseEvent<HTMLElement>) => {
      if (!clicAAvaler.current) return;
      clicAAvaler.current = false;
      ev.preventDefault();
      ev.stopPropagation();
    },
    // Un glissement au doigt ne doit pas aussi compter comme un swipe
    // du conteneur (changement de jour / semaine).
    onTouchEnd: (ev: React.TouchEvent<HTMLElement>) => {
      if (actif.current || clicAAvaler.current) ev.stopPropagation();
    },
    onTouchMove: (ev: React.TouchEvent<HTMLElement>) => {
      if (actif.current) ev.stopPropagation();
    },
    onContextMenu: (ev: React.MouseEvent<HTMLElement>) => {
      // Appui long au doigt : pas de menu contextuel (Android).
      if (saisie.current || actif.current) ev.preventDefault();
    },
  });

  return { enCours, poignee, annuler: terminer };
}
