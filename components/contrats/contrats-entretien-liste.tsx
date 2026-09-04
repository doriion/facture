"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import type { ContratEntretienListe } from "@/lib/actions/contrats-entretien";
import { LABELS_STATUT_CONTRAT_SIGNE } from "@/lib/contrats/logic";
import { formatDateFr, formatEuros } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VARIANTES_STATUT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
> = {
  brouillon: "secondary",
  envoye: "warning",
  signe: "success",
  actif: "success",
  resilie: "destructive",
  expire: "outline",
};

export function StatutContratBadge({ statut }: { statut: string }) {
  return (
    <Badge variant={VARIANTES_STATUT[statut] ?? "secondary"}>
      {LABELS_STATUT_CONTRAT_SIGNE[statut] ?? statut}
    </Badge>
  );
}

/** Barre de filtres : recherche (debounce 250 ms) + statut, via l'URL. */
export function ContratsEntretienToolbar({
  initialSearch,
  initialStatut,
}: {
  initialSearch: string;
  initialStatut: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pousser(cle: string, valeur: string) {
    const next = new URLSearchParams(params.toString());
    if (valeur && valeur !== "tous") next.set(cle, valeur);
    else next.delete(cle);
    router.replace(`/contrats?${next.toString()}`);
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(
              () => pousser("search", e.target.value.trim()),
              250,
            );
          }}
          placeholder="Rechercher (n°, client, adresse)…"
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            onClick={() => {
              setSearch("");
              pousser("search", "");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <Select
        value={initialStatut || "tous"}
        onValueChange={(v) => pousser("statut", v)}
      >
        <SelectTrigger className="sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Tous les statuts</SelectItem>
          {Object.entries(LABELS_STATUT_CONTRAT_SIGNE).map(([k, label]) => (
            <SelectItem key={k} value={k}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Liste des contrats — cartes cliquables, lisibles au téléphone. */
export function ContratsEntretienListe({
  contrats,
}: {
  contrats: ContratEntretienListe[];
}) {
  if (contrats.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Aucun contrat pour ces critères. Créez le premier avec « Nouveau
        contrat ».
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contrats.map((c) => (
        <Link
          key={c.id}
          href={`/contrats/${c.id}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {c.numero ? (
                <span className="font-mono">{c.numero}</span>
              ) : (
                <span className="text-muted-foreground">(brouillon)</span>
              )}{" "}
              — {c.client?.nom ?? "Client inconnu"}
            </p>
            <p className="text-xs text-muted-foreground">
              {c.date_effet
                ? `Effet le ${formatDateFr(c.date_effet)}`
                : "Date d'effet à définir"}
              {" · "}
              {formatEuros(Number(c.redevance) - Number(c.remise))} / an
            </p>
          </div>
          <StatutContratBadge statut={c.statut} />
        </Link>
      ))}
    </div>
  );
}
