"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, Minus, Plus, Settings2 } from "lucide-react";

import { deplacer, ecrireTuiles, lireTuiles, TUILES_PAR_DEFAUT, TUILES_POSSIBLES, tuilesDepuis } from "@/lib/tuiles-accueil";
import { libelleJourLong } from "@/lib/agenda-vues";
import { LogoMarque } from "@/components/logo-marque";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Grandes tuiles (deux par rangée, sous le pouce). Les liens sont des
 * navigations complètes (pas de <Link>) : servies par le service worker
 * depuis le cache, elles s'affichent sans attendre le serveur.
 * « Organiser » : choisir les tuiles, les ordonner.
 */
export function TuilesAccueil({ dateDuJour }: { dateDuJour: string }) {
  const [hrefs, setHrefs] = useState<string[]>(TUILES_PAR_DEFAUT);
  const [organiser, setOrganiser] = useState(false);
  useEffect(() => {
    setHrefs(lireTuiles());
  }, []);

  function enregistrer(suivant: string[]) {
    setHrefs(suivant);
    ecrireTuiles(suivant);
  }
  function basculer(href: string) {
    enregistrer(hrefs.includes(href) ? hrefs.filter((h) => h !== href) : [...hrefs, href]);
  }

  const tuiles = tuilesDepuis(hrefs);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LogoMarque taille={36} />
          <div>
            <h1 className="text-lg font-bold leading-tight">Bonjour</h1>
            <p className="text-xs capitalize text-muted-foreground">{libelleJourLong(dateDuJour)}</p>
          </div>
        </div>
        <Button type="button" variant={organiser ? "default" : "outline"} size="sm" onClick={() => setOrganiser((v) => !v)}>
          {organiser ? <Check className="size-4" /> : <Settings2 className="size-4" />}
          {organiser ? "Terminé" : "Organiser"}
        </Button>
      </div>

      {!organiser ? (
        <div className="grid grid-cols-2 gap-3">
          {tuiles.map((t) => {
            const Icon = t.icon;
            return (
              <a
                key={t.href}
                href={t.href}
                className={cn(
                  "flex min-h-28 flex-col items-start justify-between rounded-2xl border p-4 shadow-sm transition-[transform,background-color] active:scale-95",
                  t.action ? "border-primary/30 bg-primary/5" : "bg-card",
                )}
              >
                <Icon className="size-8 text-primary" strokeWidth={1.75} />
                <span>
                  <span className="block text-base font-semibold leading-tight">{t.label}</span>
                  {t.description && <span className="mt-0.5 block text-xs text-muted-foreground">{t.description}</span>}
                </span>
              </a>
            );
          })}
          {tuiles.length === 0 && <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">Aucune tuile : touchez « Organiser » pour en choisir.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Vos tuiles, dans l&apos;ordre</p>
            <ul className="divide-y rounded-lg border">
              {tuiles.map((t, i) => {
                const Icon = t.icon;
                return (
                  <li key={t.href} className="flex items-center gap-2 px-3 py-2">
                    <Icon className="size-5 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.label}</span>
                    <Button type="button" variant="ghost" size="icon" aria-label="Monter" disabled={i === 0} onClick={() => enregistrer(deplacer(hrefs, i, -1))}>
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Descendre" disabled={i === tuiles.length - 1} onClick={() => enregistrer(deplacer(hrefs, i, 1))}>
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Retirer" onClick={() => basculer(t.href)}>
                      <Minus className="size-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">À ajouter</p>
            <ul className="divide-y rounded-lg border">
              {TUILES_POSSIBLES.filter((t) => !hrefs.includes(t.href)).map((t) => {
                const Icon = t.icon;
                return (
                  <li key={t.href} className="flex items-center gap-2 px-3 py-2">
                    <Icon className="size-5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {t.label}
                      {t.action && <span className="text-xs text-muted-foreground"> · action</span>}
                    </span>
                    <Button type="button" variant="ghost" size="icon" aria-label="Ajouter" onClick={() => basculer(t.href)}>
                      <Plus className="size-4 text-primary" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => enregistrer([...TUILES_PAR_DEFAUT])}>
            Rétablir les tuiles par défaut
          </Button>
        </div>
      )}
    </div>
  );
}
