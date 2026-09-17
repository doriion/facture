"use client";

import { Search, X } from "lucide-react";

import { TYPES_CLIENT } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FiltresClientsUi = { search: string; type: string };

/** Recherche + filtre type, contrôlés par la liste (filtrage sur place, sans serveur). */
export function ClientsToolbar({
  filtres,
  onChange,
}: {
  filtres: FiltresClientsUi;
  onChange: (f: FiltresClientsUi) => void;
}) {
  const hasFilters = filtres.search || (filtres.type && filtres.type !== "tous");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filtres.search}
          onChange={(e) => onChange({ ...filtres, search: e.target.value })}
          placeholder="Rechercher (nom, ville, email, téléphone)"
          className="pl-9"
          type="search"
          enterKeyHint="search"
        />
      </div>
      <Select value={filtres.type || "tous"} onValueChange={(v) => onChange({ ...filtres, type: v })}>
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Tous les types</SelectItem>
          {Object.entries(TYPES_CLIENT).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ search: "", type: "" })}>
          <X className="size-4" />
          Effacer
        </Button>
      )}
    </div>
  );
}
