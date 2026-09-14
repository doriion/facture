"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatEuros } from "@/lib/format";
import {
  chercherPrestations,
  indexSuivant,
  type PrestationCatalogue,
} from "@/lib/catalogue-recherche";

/**
 * Champ « Désignation » avec suggestions du catalogue.
 *
 * Conçu pour le clavier, parce que c'est là qu'est le gain de temps :
 * on tape deux lettres, la liste s'ouvre, les flèches choisissent,
 * Entrée valide, et la main ne quitte jamais le clavier. La souris
 * fonctionne aussi, mais elle n'est pas le chemin principal.
 *
 * Le composant ne décide rien : le filtrage, le classement et les
 * valeurs déposées dans la ligne viennent de lib/catalogue-recherche,
 * qui est testé. Ici, il n'y a que de l'affichage et du clavier.
 */
export function DesignationAutocomplete({
  value,
  onChange,
  onSelectPrestation,
  catalogue,
  placeholder = "Désignation de la prestation",
  id,
  onBlur,
  name,
  inputRef,
}: {
  value: string;
  /** Frappe libre : la ligne garde exactement ce qui est tapé. */
  onChange: (valeur: string) => void;
  /** Choix d'une suggestion : remplit désignation, prix, coûts. */
  onSelectPrestation: (prestation: PrestationCatalogue) => void;
  catalogue: PrestationCatalogue[];
  placeholder?: string;
  id?: string;
  onBlur?: () => void;
  name?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  // Vrai seulement après une vraie frappe : sans ça, la liste
  // s'ouvrirait toute seule sur une ligne pré-remplie (duplication,
  // modèle, édition d'un devis existant).
  const [aTape, setATape] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const listeId = useId();

  const suggestions = useMemo(
    () => (aTape ? chercherPrestations(catalogue, value ?? "") : []),
    [catalogue, value, aTape],
  );

  const visible = ouvert && suggestions.length > 0;

  // L'index actif ne doit jamais désigner une suggestion disparue
  // pendant la frappe.
  useEffect(() => {
    setActif((i) => (i >= suggestions.length ? -1 : i));
  }, [suggestions.length]);

  // Clic à l'extérieur : on referme sans rien choisir. Le champ garde
  // ce qui a été tapé — une suggestion survolée n'est pas un choix.
  useEffect(() => {
    if (!visible) return;
    function surClicExterieur(e: MouseEvent) {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [visible]);

  function choisir(index: number) {
    const p = suggestions[index];
    if (!p) return;
    onSelectPrestation(p);
    setOuvert(false);
    setActif(-1);
    setATape(false);
  }

  function surTouche(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Rouvrir à la flèche après une fermeture à l'Échap, sans
      // obliger à retaper une lettre.
      if (!visible && suggestions.length > 0) {
        setOuvert(true);
        e.preventDefault();
        return;
      }
      if (!visible) return;
      e.preventDefault();
      setActif((i) =>
        indexSuivant(i, suggestions.length, e.key === "ArrowDown" ? 1 : -1),
      );
      return;
    }

    if (e.key === "Enter") {
      // Entrée ne valide QUE s'il y a une suggestion sélectionnée.
      // Sinon on laisse passer : le formulaire garde son
      // comportement habituel, et une saisie libre n'est jamais
      // remplacée par une proposition qu'on n'a pas choisie.
      if (visible && actif >= 0) {
        e.preventDefault();
        choisir(actif);
      }
      return;
    }

    if (e.key === "Escape") {
      if (visible) {
        e.stopPropagation();
        setOuvert(false);
        setActif(-1);
      }
      return;
    }

    // Tab quitte le champ : on referme sans choisir, pour ne pas
    // écrire une prestation dans le dos de l'utilisateur.
    if (e.key === "Tab" && visible) {
      setOuvert(false);
      setActif(-1);
    }
  }

  return (
    <div ref={conteneur} className="relative">
      <Input
        id={id}
        name={name}
        ref={inputRef}
        value={value ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={visible}
        aria-controls={visible ? listeId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          visible && actif >= 0 ? `${listeId}-${actif}` : undefined
        }
        onChange={(e) => {
          setATape(true);
          setOuvert(true);
          onChange(e.target.value);
        }}
        onKeyDown={surTouche}
        onBlur={onBlur}
      />

      {visible && (
        <ul
          id={listeId}
          role="listbox"
          aria-label="Prestations du catalogue"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md"
        >
          {suggestions.map((p, i) => (
            <li
              key={p.id}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === actif}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-sm ${
                i === actif ? "bg-accent text-accent-foreground" : ""
              }`}
              onMouseEnter={() => setActif(i)}
              // mousedown plutôt que click : le blur du champ
              // arriverait avant le click et fermerait la liste.
              onMouseDown={(e) => {
                e.preventDefault();
                choisir(i);
              }}
            >
              <span className="min-w-0">
                <span className="block truncate">{p.designation}</span>
                {p.description && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.description}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatEuros(Number(p.prix_ht))}
                {p.unite ? ` / ${p.unite}` : ""}
              </span>
            </li>
          ))}
          <li className="border-t px-3 pb-0.5 pt-1.5 text-[11px] text-muted-foreground">
            ↑ ↓ pour choisir · Entrée pour valider · Échap pour fermer
          </li>
        </ul>
      )}
    </div>
  );
}
