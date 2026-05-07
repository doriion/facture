"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
import {
  LABELS_TYPE_INTERVENTION,
  TYPES_INTERVENTION,
} from "@/lib/validations/intervention";

export function InterventionsToolbar({
  initialSearch,
  initialType,
}: {
  initialSearch: string;
  initialType: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set("search", search);
      else next.delete("search");
      router.replace(`/interventions?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setType(type: string) {
    const next = new URLSearchParams(params.toString());
    if (type === "tous") next.delete("type");
    else next.set("type", type);
    router.replace(`/interventions?${next.toString()}`);
  }

  function clearAll() {
    setSearch("");
    router.replace("/interventions");
  }

  const hasFilters = search || (initialType && initialType !== "tous");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (description, équipement, n° série)"
          className="pl-9"
        />
      </div>
      <Select value={initialType || "tous"} onValueChange={setType}>
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
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="size-4" />
          Effacer
        </Button>
      )}
    </div>
  );
}
