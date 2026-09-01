"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Coffee, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  aujourdhuiParis,
  classerTaches,
  filtrerTaches,
} from "@/lib/taches-logic";
import type { TacheAvecDetails } from "@/lib/actions/taches";
import { TacheItem } from "@/components/taches/tache-item";

export type VueTaches = "aujourdhui" | "avenir" | "faites";

/**
 * Les trois vues du pense-bête. Onglets = liens (?vue=…) pour rester
 * partageables/rafraîchissables ; le classement par dates est fait
 * côté client avec la date du téléphone (logique pure testée).
 */
export function TachesListe({
  taches,
  vue,
  recherche: rechercheInitiale = "",
}: {
  taches: TacheAvecDetails[];
  vue: VueTaches;
  recherche?: string;
}) {
  // Recherche instantanée, côté client (titre + notes, accents ignorés)
  const [recherche, setRecherche] = useState(rechercheInitiale);
  const today = aujourdhuiParis();
  const classement = useMemo(
    () => classerTaches(filtrerTaches(taches, recherche), today),
    [taches, recherche, today],
  );

  const nbAujourdhui =
    classement.enRetard.length +
    classement.aujourdhui.length +
    classement.sansDate.length;

  const onglets: Array<{ id: VueTaches; label: string; compte: number }> = [
    { id: "aujourdhui", label: "Aujourd'hui", compte: nbAujourdhui },
    { id: "avenir", label: "À venir", compte: classement.aVenir.length },
    { id: "faites", label: "Faites", compte: classement.faites.length },
  ];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher (titre, notes)…"
          className="pl-9 pr-9"
          aria-label="Rechercher dans les tâches"
        />
        {recherche && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => setRecherche("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-lg border bg-card p-1">
        {onglets.map((o) => (
          <Link
            key={o.id}
            href={o.id === "aujourdhui" ? "/taches" : `/taches?vue=${o.id}`}
            replace
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-sm font-medium transition-colors",
              vue === o.id
                ? "bg-primary text-primary-foreground"
                : "text-foreground/70 hover:bg-accent",
            )}
          >
            <span className="truncate">{o.label}</span>
            {o.compte > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  vue === o.id
                    ? "bg-primary-foreground/20"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {o.compte}
              </span>
            )}
          </Link>
        ))}
      </div>

      {vue === "aujourdhui" && (
        <div className="space-y-5">
          {nbAujourdhui === 0 && (
            <EtatVide
              icone={<Coffee className="size-8" />}
              message="Rien à faire aujourd'hui. Profitez-en — ou notez ce qui vous trotte dans la tête avec le bouton +."
            />
          )}
          {classement.enRetard.length > 0 && (
            <Section titre="En retard" accent="destructive">
              {classement.enRetard.map((t) => (
                <TacheItem key={t.id} tache={t} joursRetard={t.joursRetard} />
              ))}
            </Section>
          )}
          {classement.aujourdhui.length > 0 && (
            <Section titre="Aujourd'hui">
              {classement.aujourdhui.map((t) => (
                <TacheItem key={t.id} tache={t} />
              ))}
            </Section>
          )}
          {classement.sansDate.length > 0 && (
            <Section titre="Sans date">
              {classement.sansDate.map((t) => (
                <TacheItem key={t.id} tache={t} />
              ))}
            </Section>
          )}
        </div>
      )}

      {vue === "avenir" && (
        <div className="space-y-2">
          {classement.aVenir.length === 0 ? (
            <EtatVide
              icone={<CheckCircle2 className="size-8" />}
              message="Aucune tâche planifiée. Ajoutez une date à une tâche pour la retrouver ici."
            />
          ) : (
            classement.aVenir.map((t) => <TacheItem key={t.id} tache={t} />)
          )}
        </div>
      )}

      {vue === "faites" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Les tâches faites des 30 derniers jours. Recochez le rond vert
            pour en remettre une à faire.
          </p>
          {classement.faites.length === 0 ? (
            <EtatVide
              icone={<CheckCircle2 className="size-8" />}
              message="Rien de fait ces 30 derniers jours (ou tout reste à faire !)."
            />
          ) : (
            classement.faites.map((t) => <TacheItem key={t.id} tache={t} />)
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  titre,
  accent,
  children,
}: {
  titre: string;
  accent?: "destructive";
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        className={cn(
          "mb-2 text-xs font-semibold uppercase tracking-wide",
          accent === "destructive"
            ? "text-destructive"
            : "text-muted-foreground",
        )}
      >
        {titre}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EtatVide({
  icone,
  message,
}: {
  icone: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      {icone}
      <p className="max-w-sm text-sm">{message}</p>
    </div>
  );
}
