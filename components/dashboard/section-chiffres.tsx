"use client";

import { useState } from "react";
import { BarChart3, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sur téléphone, les chiffres (indicateurs, seuils, cotisations,
 * graphiques, listes récentes) sont repliés sous un bouton : le fil du
 * jour et les alertes restent seuls à l'écran sur le chantier. Sur PC,
 * tout est visible comme avant.
 */
export function SectionChiffres({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="space-y-6">
      <Button type="button" variant="outline" className="w-full justify-between md:hidden" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <span className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          {ouvert ? "Masquer les chiffres" : "Voir les chiffres (CA, seuils, cotisations, graphiques)"}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", ouvert && "rotate-180")} />
      </Button>
      <div className={cn("space-y-6", !ouvert && "max-md:hidden")}>{children}</div>
    </div>
  );
}
