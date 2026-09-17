"use client";

import { useMemo } from "react";

import { filtrerFactures } from "@/lib/filtres-listes";
import { FacturesTable } from "@/components/factures/factures-table";
import { FacturesToolbar, type FiltresFactures } from "@/components/factures/factures-toolbar";
import { useFiltresListe } from "@/components/liste-filtree";

type Facture = React.ComponentProps<typeof FacturesTable>["factures"][number] & { notes?: string | null };

/** Sous-titre, recherche, filtres et tableau : tout se filtre sur place. */
export function FacturesListe({ factures, initial }: { factures: Facture[]; initial: FiltresFactures }) {
  const [filtres, setFiltres] = useFiltresListe("/factures", initial);
  const filtrees = useMemo(() => filtrerFactures(factures, filtres), [factures, filtres]);
  const total = filtrees.reduce((s, f) => s + Number(f.total_ht), 0);

  return (
    <div className="space-y-6">
      <p className="-mt-4 text-sm text-muted-foreground">
        {filtrees.length} facture{filtrees.length > 1 ? "s" : ""} —{" "}
        {total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} cumulés
      </p>
      <FacturesToolbar filtres={filtres} onChange={setFiltres} />
      <FacturesTable factures={filtrees} />
    </div>
  );
}
