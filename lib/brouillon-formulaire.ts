"use client";

import { useEffect, useRef } from "react";
import type { FieldValues, UseFormReset, UseFormWatch } from "react-hook-form";
import { toast } from "sonner";

/**
 * Brouillon local d'un formulaire long (devis, facture) : la saisie est
 * recopiée dans localStorage au fil de l'eau et proposée au retour si
 * elle n'a pas été enregistrée (retour arrière, onglet de la barre du
 * bas, rechargement, appli tuée par iOS). Sur le chantier, un devis
 * saisi ligne à ligne ne doit pas disparaître d'un tap.
 *
 * Effacé à l'enregistrement réussi ; « Repartir de zéro » l'efface aussi.
 */
const PREFIXE = "ng:brouillon:";
const DELAI_MS = 800;

type Enveloppe = { valeurs: unknown; date: string };

export function lireBrouillon<T>(cle: string): { valeurs: T; date: string } | null {
  try {
    const brut = localStorage.getItem(PREFIXE + cle);
    if (!brut) return null;
    const env = JSON.parse(brut) as Enveloppe;
    if (!env || typeof env !== "object" || !env.valeurs) return null;
    return { valeurs: env.valeurs as T, date: env.date };
  } catch {
    return null;
  }
}

export function effacerBrouillon(cle: string): void {
  try {
    localStorage.removeItem(PREFIXE + cle);
  } catch {
    // Stockage indisponible (navigation privée) : rien à effacer.
  }
}

function ecrireBrouillon(cle: string, valeurs: unknown): void {
  try {
    const env: Enveloppe = { valeurs, date: new Date().toISOString() };
    localStorage.setItem(PREFIXE + cle, JSON.stringify(env));
  } catch {
    // Quota ou stockage indisponible : on n'insiste pas.
  }
}

export function useBrouillonFormulaire<T extends FieldValues>(opts: {
  /** Ex. « devis:nouveau », « facture:<id> ». */
  cle: string;
  /** false = pas de brouillon (document verrouillé, pré-rempli depuis une autre source…). */
  actif: boolean;
  watch: UseFormWatch<T>;
  reset: UseFormReset<T>;
  /** Pour le message : « Devis », « Facture ». */
  libelle: string;
}): { effacer: () => void } {
  const { cle, actif, watch, reset, libelle } = opts;
  const pret = useRef(false);

  useEffect(() => {
    if (!actif) return;
    const brouillon = lireBrouillon<T>(cle);
    if (brouillon) {
      reset(brouillon.valeurs, { keepDefaultValues: true });
      toast(`${libelle} : brouillon récupéré`, {
        description: "Votre saisie précédente n'avait pas été enregistrée.",
        duration: 10_000,
        action: {
          label: "Repartir de zéro",
          onClick: () => {
            effacerBrouillon(cle);
            reset();
          },
        },
      });
    }
    pret.current = true;
    let minuteur: ReturnType<typeof setTimeout> | null = null;
    const abonnement = watch((valeurs) => {
      if (!pret.current) return;
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => ecrireBrouillon(cle, valeurs), DELAI_MS);
    });
    return () => {
      abonnement.unsubscribe();
      if (minuteur) clearTimeout(minuteur);
      pret.current = false;
    };
  }, [cle, actif, watch, reset, libelle]);

  return { effacer: () => effacerBrouillon(cle) };
}
