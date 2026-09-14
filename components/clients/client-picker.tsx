"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { chercherClients, libelleClient } from "@/lib/recherche-clients";
import { indexSuivant } from "@/lib/catalogue-recherche";
import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];

/**
 * Choix du client, en tête du formulaire de devis : on commence
 * toujours par « pour qui ». Recherche instantanée sur le nom, la
 * ville, l'email et le téléphone, navigation au clavier, et création
 * d'un nouveau client en dialogue sans quitter le devis.
 *
 * Le menu déroulant natif obligeait à faire défiler une liste entière
 * dès qu'il y a quelques dizaines de clients, et créer un client
 * imposait d'abandonner la saisie en cours.
 */
export function ClientPicker({
  clients,
  value,
  onChange,
  error,
  id = "client_id",
}: {
  clients: Client[];
  value: string;
  onChange: (clientId: string) => void;
  error?: string;
  id?: string;
}) {
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const conteneur = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  const selectionne = useMemo(
    () => clients.find((c) => c.id === value) ?? null,
    [clients, value],
  );

  const resultats = useMemo(
    () => chercherClients(clients, saisie),
    [clients, saisie],
  );
  const visible = ouvert && resultats.length > 0;

  useEffect(() => {
    setActif((i) => (i >= resultats.length ? -1 : i));
  }, [resultats.length]);

  useEffect(() => {
    if (!ouvert) return;
    function surClicExterieur(e: MouseEvent) {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", surClicExterieur);
    return () => document.removeEventListener("mousedown", surClicExterieur);
  }, [ouvert]);

  function choisir(index: number) {
    const c = resultats[index];
    if (!c) return;
    onChange(c.id);
    setSaisie("");
    setOuvert(false);
    setActif(-1);
  }

  function surTouche(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!ouvert) {
        setOuvert(true);
        return;
      }
      setActif((i) =>
        indexSuivant(i, resultats.length, e.key === "ArrowDown" ? 1 : -1),
      );
      return;
    }
    if (e.key === "Enter") {
      // Sans sélection, on bloque quand même la soumission : Entrée
      // dans un champ de recherche ne doit pas créer le devis.
      e.preventDefault();
      if (visible && actif >= 0) choisir(actif);
      else if (visible && resultats.length === 1) choisir(0);
      return;
    }
    if (e.key === "Escape" && ouvert) {
      e.stopPropagation();
      setOuvert(false);
      setActif(-1);
    }
  }

  // Client déjà choisi : on affiche la fiche plutôt que le champ de
  // recherche, pour que le formulaire dise clairement pour qui est le
  // devis. « Changer » rouvre la recherche.
  if (selectionne) {
    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <Check className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="font-medium">{selectionne.nom}</span>
            {selectionne.ville && (
              <span className="text-muted-foreground"> · {selectionne.ville}</span>
            )}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange("");
              setSaisie("");
              setOuvert(true);
              // Le champ n'existe qu'après ce rendu.
              setTimeout(() => champ.current?.focus(), 0);
            }}
          >
            <X className="size-4" />
            Changer
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div ref={conteneur} className="relative">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Input
              id={id}
              ref={champ}
              value={saisie}
              placeholder="Rechercher un client par nom, ville, email…"
              autoComplete="off"
              role="combobox"
              aria-expanded={visible}
              aria-autocomplete="list"
              onChange={(e) => {
                setSaisie(e.target.value);
                setOuvert(true);
              }}
              onFocus={() => setOuvert(true)}
              onKeyDown={surTouche}
              className="pr-9"
            />
            <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          {/* Création sans quitter le devis : le nouveau client est
              sélectionné dès sa création, la saisie continue. */}
          <ClientFormDialog
            onCreated={(nouvelId) => {
              onChange(nouvelId);
              setSaisie("");
              setOuvert(false);
            }}
            trigger={
              <Button type="button" variant="outline">
                <Plus className="size-4" />
                Nouveau client
              </Button>
            }
          />
        </div>

        {visible && (
          <ul
            role="listbox"
            aria-label="Clients"
            className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md"
          >
            {resultats.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={i === actif}
                className={`cursor-pointer px-3 py-1.5 text-sm ${
                  i === actif ? "bg-accent text-accent-foreground" : ""
                }`}
                onMouseEnter={() => setActif(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(i);
                }}
              >
                <span className="block truncate">{libelleClient(c)}</span>
              </li>
            ))}
          </ul>
        )}

        {ouvert && saisie.trim() !== "" && resultats.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
            Aucun client ne correspond. Créez-le avec « Nouveau client ».
          </div>
        )}
      </div>

      {clients.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aucun client enregistré : créez le premier avec « Nouveau client »,
          sans quitter ce devis.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
