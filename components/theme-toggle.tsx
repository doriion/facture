"use client";

import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import {
  CLASSE_SOMBRE,
  CLE_THEME,
  LABELS_THEME,
  PREFERENCE_DEFAUT,
  preferenceValide,
  themeEffectif,
  type PreferenceTheme,
} from "@/lib/theme-mode";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const ICONES: Record<PreferenceTheme, typeof Sun> = {
  clair: Sun,
  sombre: Moon,
  systeme: Monitor,
};

const ORDRE: PreferenceTheme[] = ["clair", "sombre", "systeme"];

const MEDIA_SOMBRE = "(prefers-color-scheme: dark)";

function systemeEstSombre(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(MEDIA_SOMBRE).matches
  );
}

/** Pose ou retire la classe sur <html>, sans rien casser si le stockage refuse. */
function appliquer(preference: PreferenceTheme) {
  const sombre = themeEffectif(preference, systemeEstSombre()) === "sombre";
  document.documentElement.classList.toggle(CLASSE_SOMBRE, sombre);
  try {
    localStorage.setItem(CLE_THEME, preference);
  } catch {
    // Navigation privée ou stockage bloqué : le choix vaut pour cette
    // session, il ne sera simplement pas retenu au prochain lancement.
  }
}

/**
 * Choix de l'apparence, placé dans le menu du compte.
 *
 * Trois états plutôt qu'un simple interrupteur : « Système » permet à
 * l'application de basculer toute seule le soir si l'ordinateur le
 * fait déjà, sans avoir à y penser. C'est le choix par défaut.
 *
 * Le rendu initial ne dépend d'aucun état lu côté client : le thème
 * est déjà appliqué par le script du <head> avant le premier affichage.
 * Ce composant ne sert qu'à en changer et à montrer lequel est actif —
 * d'où la coche affichée seulement une fois monté, pour éviter une
 * différence entre le HTML du serveur et celui du navigateur.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState<PreferenceTheme>(
    PREFERENCE_DEFAUT,
  );
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    let stockee: string | null = null;
    try {
      stockee = localStorage.getItem(CLE_THEME);
    } catch {
      stockee = null;
    }
    setPreference(preferenceValide(stockee));
    setMonte(true);
  }, []);

  // En mode « Système », suivre les changements en direct : l'ordinateur
  // qui bascule au coucher du soleil doit entraîner l'application, sans
  // avoir à recharger la page.
  useEffect(() => {
    if (preference !== "systeme") return;
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(MEDIA_SOMBRE);
    const surChangement = () => appliquer("systeme");
    media.addEventListener("change", surChangement);
    return () => media.removeEventListener("change", surChangement);
  }, [preference]);

  function choisir(valeur: PreferenceTheme) {
    setPreference(valeur);
    appliquer(valeur);
  }

  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        Apparence
      </DropdownMenuLabel>
      {ORDRE.map((valeur) => {
        const Icone = ICONES[valeur];
        const actif = monte && preference === valeur;
        return (
          <DropdownMenuItem
            key={valeur}
            onSelect={(e) => {
              // Garder le menu ouvert : on compare souvent les deux
              // apparences avant de se décider.
              e.preventDefault();
              choisir(valeur);
            }}
            className="cursor-pointer"
          >
            <Icone className="size-4" />
            <span>{LABELS_THEME[valeur]}</span>
            {actif && <Check className="ml-auto size-4 text-primary" />}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}
