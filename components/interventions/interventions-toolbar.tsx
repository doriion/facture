"use client";

import { Search, X } from "lucide-react";

import {
  LABELS_TYPE_INTERVENTION,
  TYPES_INTERVENTION,
} from "@/lib/validations/intervention";
import { Button } from "@/components/ui/button";
import { LABELS_STATUT_INTERVENTION, type StatutIntervention } from "@/lib/interventions-helpers";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FiltresInterventionsUi = { search: string; type: string; statut: string };

/** Recherche + filtre type, contrôlés par la liste (filtrage sur place, sans serveur). */
export function InterventionsToolbar({
  filtres,
  onChange,
}: {
  filtres: FiltresInterventionsUi;
  onChange: (f: FiltresInterventionsUi) => void;
}) {
  const hasFilters =
    filtres.search ||
    (filtres.type && filtres.type !== "tous") ||
    (filtres.statut && filtres.statut !== "tous");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filtres.search}
          onChange={(e) => onChange({ ...filtres, search: e.target.value })}
          placeholder="Rechercher (description, client, équipement, n° série)"
          className="pl-9"
          type="search"
          enterKeyHint="search"
        />
      </div>
      <Select value={filtres.statut || "tous"} onValueChange={(v) => onChange({ ...filtres, statut: v })}>
        <SelectTrigger className="w-[170px]" aria-label="Statut">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Tous statuts</SelectItem>
          {(Object.keys(LABELS_STATUT_INTERVENTION) as StatutIntervention[]).map((s) => (
            <SelectItem key={s} value={s}>
              {LABELS_STATUT_INTERVENTION[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filtres.type || "tous"} onValueChange={(v) => onChange({ ...filtres, type: v })}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Tous types</SelectItem>
          {TYPES_INTERVENTION.map((t) => (
            <SelectItem key={t} value={t}>
              {LABELS_TYPE_INTERVENTION[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => onChange({ search: "", type: "", statut: "" })}>
          <X className="size-4" />
          Effacer
        </Button>
      )}
    </div>
  );
}
