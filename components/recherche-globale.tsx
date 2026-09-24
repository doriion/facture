"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { rechercheGlobaleAction } from "@/lib/actions/recherche";
import { appelerAction } from "@/lib/appel-action";
import {
  aplatirGroupes,
  deplacerSelection,
  normaliserRequete,
  resumerGroupes,
  type GroupeRecherche,
} from "@/lib/recherche-helpers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const DELAI_MS = 250;

/**
 * Recherche globale : bouton dans le bandeau (loupe) et raccourci
 * Ctrl/⌘ K. Une saisie, sept familles de résultats (clients, factures,
 * devis, interventions, contrats, visites, tâches), navigation ↑ ↓
 * Entrée, Échap pour fermer. Les résultats sont des liens : ils
 * fonctionnent aussi au doigt.
 */
export function RechercheGlobale() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [groupes, setGroupes] = useState<GroupeRecherche[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [selection, setSelection] = useState(-1);
  const derniereRequete = useRef(0);
  const listeRef = useRef<HTMLDivElement>(null);

  // Raccourci clavier global (PC) : Ctrl/⌘ K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Requête après un court délai, résultats de la dernière saisie seulement
  useEffect(() => {
    if (!open) return;
    const requete = normaliserRequete(saisie);
    if (!requete) {
      setGroupes([]);
      setErreur(null);
      setChargement(false);
      return;
    }
    const numero = ++derniereRequete.current;
    setChargement(true);
    const t = window.setTimeout(async () => {
      const res = await appelerAction(() => rechercheGlobaleAction(requete));
      if (numero !== derniereRequete.current) return;
      setChargement(false);
      if (res.ok) {
        setGroupes(res.data.groupes);
        setErreur(null);
      } else {
        setGroupes([]);
        setErreur(res.error);
      }
      setSelection(-1);
    }, DELAI_MS);
    return () => window.clearTimeout(t);
  }, [saisie, open]);

  // Réinitialisation à la fermeture
  useEffect(() => {
    if (open) return;
    setSaisie("");
    setGroupes([]);
    setSelection(-1);
    setErreur(null);
  }, [open]);

  const { groupes: pleins, total } = resumerGroupes(groupes);
  const plat = aplatirGroupes(pleins);

  const ouvrir = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const suivant = deplacerSelection(selection, plat.length, e.key === "ArrowDown" ? 1 : -1);
      setSelection(suivant);
      listeRef.current
        ?.querySelector<HTMLElement>(`[data-index="${suivant}"]`)
        ?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      const cible = plat[selection] ?? plat[0];
      if (cible) {
        e.preventDefault();
        ouvrir(cible.href);
      }
    }
  }

  const requeteValide = normaliserRequete(saisie) !== null;
  let indexCourant = -1;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-muted-foreground max-sm:h-10 max-sm:w-10 max-sm:px-0"
        aria-label="Rechercher (Ctrl K)"
        title="Rechercher — Ctrl K"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Rechercher</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] md:inline">
          Ctrl K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[10%] translate-y-0 gap-0 p-0 sm:max-w-xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Recherche</DialogTitle>
          <DialogDescription className="sr-only">
            Clients, factures, devis, interventions, contrats, visites, tâches.
          </DialogDescription>
          <div className="flex items-center gap-2 border-b px-3">
            {chargement ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="size-4 shrink-0 text-muted-foreground" />
            )}
            <input
              autoFocus
              // text (et non search) : pas de croix native en double avec
              // celle du dialogue
              type="text"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Client, numéro, adresse, matériel, tâche…"
              aria-label="Rechercher"
              aria-activedescendant={selection >= 0 ? `recherche-${selection}` : undefined}
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
              enterKeyHint="go"
              autoComplete="off"
            />
          </div>

          <div ref={listeRef} className="max-h-[60dvh] overflow-y-auto overscroll-contain p-2">
            {!requeteValide && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Tapez au moins deux caractères : nom de client, numéro de facture
                ou de devis, adresse, matériel, tâche.
              </p>
            )}
            {requeteValide && erreur && (
              <p className="px-2 py-6 text-center text-sm text-destructive">{erreur}</p>
            )}
            {requeteValide && !erreur && !chargement && total === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Aucun résultat pour « {saisie.trim()} ».
              </p>
            )}
            {pleins.map((g) => (
              <div key={g.cle} className="mb-2">
                <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.libelle}
                </p>
                <ul role="listbox" aria-label={g.libelle}>
                  {g.resultats.map((r) => {
                    indexCourant += 1;
                    const index = indexCourant;
                    const actif = index === selection;
                    return (
                      <li key={r.id} role="option" aria-selected={actif} id={`recherche-${index}`}>
                        <button
                          type="button"
                          data-index={index}
                          onClick={() => ouvrir(r.href)}
                          onMouseEnter={() => setSelection(index)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                            actif ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{r.titre}</span>
                            {r.sousTitre && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {r.sousTitre}
                              </span>
                            )}
                          </span>
                          {r.etiquette && (
                            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              {r.etiquette}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {total > 0 && (
            <p className="hidden border-t px-3 py-1.5 text-[11px] text-muted-foreground sm:block">
              ↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
