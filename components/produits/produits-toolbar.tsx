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
import { CATEGORIES_PRESTATIONS } from "@/lib/format";

export function ProduitsToolbar({
  initialSearch,
  initialCategorie,
}: {
  initialSearch: string;
  initialCategorie: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set("search", search);
      else next.delete("search");
      router.replace(`/produits?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setCategorie(c: string) {
    const next = new URLSearchParams(params.toString());
    if (c === "toutes") next.delete("categorie");
    else next.set("categorie", c);
    router.replace(`/produits?${next.toString()}`);
  }

  function clearAll() {
    setSearch("");
    router.replace("/produits");
  }

  const hasFilters = search || (initialCategorie && initialCategorie !== "toutes");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (désignation, description)"
          className="pl-9"
        />
      </div>
      <Select
        value={initialCategorie || "toutes"}
        onValueChange={setCategorie}
      >
        <SelectTrigger className="w-[260px]">
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
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="size-4" />
          Effacer
        </Button>
      )}
    </div>
  );
}
