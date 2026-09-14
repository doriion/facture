"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
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
 * Le champ est MULTI-LIGNES : Entrée (sans suggestion sélectionnée)
 * revient à la ligne — groupe extérieur sur une ligne, unités
 * intérieures en dessous — et le champ grandit tout seul. Les retours
 * à la ligne sont conservés tels quels jusqu'au PDF.
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
}) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  // Vrai seulement après une vraie frappe : sans ça, la liste
  // s'ouvrirait toute seule sur une ligne pré-remplie (duplication,
  // modèle, édition d'un devis existant).
  const [aTape, setATape] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);
  const listeId = useId();

  const suggestions = useMemo(
    () => (aTape ? chercherPrestations(catalogue, value ?? "") : []),
    [catalogue, value, aTape],
  );

  const visible = ouvert && suggestions.length > 0;

  // Hauteur automatique : le champ suit son contenu (1 ligne au repos,
  // autant que nécessaire ensuite), sans barre de défilement. Recalculé
  // à chaque changement de valeur, y compris un remplissage externe
  // (suggestion choisie, duplication, modèle).
  useLayoutEffect(() => {
    const el = champ.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

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

  function surTouche(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Liste ouverte : les flèches parcourent les suggestions. Liste
      // fermée : elles déplacent le curseur dans le texte, comme dans
      // n'importe quel champ multi-lignes (la liste se rouvre à la
      // frappe suivante).
      if (!visible) return;
      e.preventDefault();
      setActif((i) =>
        indexSuivant(i, suggestions.length, e.key === "ArrowDown" ? 1 : -1),
      );
      return;
    }

    if (e.key === "Enter") {
      // Entrée ne valide QUE s'il y a une suggestion sélectionnée.
      // Sinon on laisse passer : c'est un retour à la ligne dans la
      // désignation, et une saisie libre n'est jamais remplacée par
      // une proposition qu'on n'a pas choisie.
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
      {/* Mêmes cotes que <Input> (h-11 / sm:h-10) au repos, pour rester
          aligné avec Quantité et Prix ; grandit avec le contenu. */}
      <textarea
        id={id}
        name={name}
        ref={champ}
        value={value ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        rows={1}
        role="combobox"
        aria-expanded={visible}
        aria-controls={visible ? listeId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          visible && actif >= 0 ? `${listeId}-${actif}` : undefined
        }
        className={cn(
          "flex min-h-11 w-full resize-none overflow-hidden rounded-md border border-input bg-background px-3 py-2.5 text-base leading-6 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:py-2 sm:text-sm",
        )}
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
            ↑ ↓ pour choisir · Entrée pour valider · Échap pour fermer · Entrée
            sans suggestion : retour à la ligne
          </li>
        </ul>
      )}
    </div>
  );
}
