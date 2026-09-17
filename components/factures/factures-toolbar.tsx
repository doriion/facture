"use client";

import { Search, X } from "lucide-react";

import { LABELS_STATUT_FACTURE, LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FiltresFactures = { search: string; statut: string; type: string };

/** Recherche + filtres, contrôlés par la liste (filtrage sur place, sans serveur). */
export function FacturesToolbar({
  filtres,
  onChange,
}: {
  filtres: FiltresFactures;
  onChange: (f: FiltresFactures) => void;
}) {
  const hasFilters =
    filtres.search || (filtres.statut && filtres.statut !== "tous") || (filtres.type && filtres.type !== "tous");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filtres.search}
          onChange={(e) => onChange({ ...filtres, search: e.target.value })}
          placeholder="Rechercher (numéro, client, notes)"
          className="pl-9"
          type="search"
          enterKeyHint="search"
        />
      </div>
      <Select value={filtres.statut || "tous"} onValueChange={(v) => onChange({ ...filtres, statut: v })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Tous statuts</SelectItem>
          {Object.entries(LABELS_STATUT_FACTURE).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filtres.type || "tous"} onValueChange={(v) => onChange({ ...filtres, type: v })}>
        <SelectTrigger className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Toutes activités</SelectItem>
          {Object.entries(LABELS_TYPE_ACTIVITE).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ search: "", statut: "", type: "" })}>
          <X className="size-4" />
          Effacer
        </Button>
      )}
    </div>
  );
}
