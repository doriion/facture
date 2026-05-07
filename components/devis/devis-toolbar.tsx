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
import { LABELS_STATUT_DEVIS, LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";

export function DevisToolbar({
  initialSearch,
  initialStatut,
  initialType,
}: {
  initialSearch: string;
  initialStatut: string;
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
      router.replace(`/devis?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParam(key: string, value: string, allValue: string) {
    const next = new URLSearchParams(params.toString());
    if (value === allValue) next.delete(key);
    else next.set(key, value);
    router.replace(`/devis?${next.toString()}`);
  }

  function clearAll() {
    setSearch("");
    router.replace("/devis");
  }

  const hasFilters =
    search ||
    (initialStatut && initialStatut !== "tous") ||
    (initialType && initialType !== "tous");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (numéro, notes)"
          className="pl-9"
        />
      </div>
      <Select
        value={initialStatut || "tous"}
        onValueChange={(v) => setParam("statut", v, "tous")}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Tous statuts</SelectItem>
          {Object.entries(LABELS_STATUT_DEVIS).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={initialType || "tous"}
        onValueChange={(v) => setParam("type", v, "tous")}
      >
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
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="size-4" />
          Effacer
        </Button>
      )}
    </div>
  );
}
