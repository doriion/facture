"use client";

import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CATEGORIES_PRESTATIONS } from "@/lib/format";

export type FiltresProduitsUi = { search: string; categorie: string };

export function ProduitsToolbar({
  filtres,
  onChange,
}: {
  filtres: FiltresProduitsUi;
  onChange: (f: FiltresProduitsUi) => void;
}) {
  const hasFilters = Boolean(filtres.search) || (filtres.categorie && filtres.categorie !== "toutes");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={filtres.search}
          onChange={(e) => onChange({ ...filtres, search: e.target.value })}
          placeholder="Rechercher (désignation, description)"
          className="pl-9"
          aria-label="Rechercher dans le catalogue"
        />
      </div>
      <Select
        value={filtres.categorie || "toutes"}
        onValueChange={(c) => onChange({ ...filtres, categorie: c === "toutes" ? "" : c })}
      >
        <SelectTrigger className="w-full sm:w-[260px]" aria-label="Catégorie">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="toutes">Toutes catégories</SelectItem>
          {Object.entries(CATEGORIES_PRESTATIONS).map(([k, label]) => (
            <SelectItem key={k} value={k}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ search: "", categorie: "" })}>
          <X className="size-4" />
          Effacer
        </Button>
      )}
    </div>
  );
}
