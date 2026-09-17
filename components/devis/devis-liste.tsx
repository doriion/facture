"use client";

import { useMemo } from "react";

import { filtrerDevis } from "@/lib/filtres-listes";
import { DevisTable } from "@/components/devis/devis-table";
import { DevisToolbar, type FiltresDevis } from "@/components/devis/devis-toolbar";
import { useFiltresListe } from "@/components/liste-filtree";

type Devis = React.ComponentProps<typeof DevisTable>["devis"][number] & { notes?: string | null };

/** Sous-titre (total, taux d'acceptation), recherche, filtres et tableau, sur place. */
export function DevisListe({ devis, initial }: { devis: Devis[]; initial: FiltresDevis }) {
  const [filtres, setFiltres] = useFiltresListe("/devis", initial);
  const filtrees = useMemo(() => filtrerDevis(devis, filtres), [devis, filtres]);
  const total = filtrees.reduce((s, d) => s + Number(d.total_ht), 0);
  const acceptes = filtrees.filter((d) => d.statut === "accepte").length;
  const envoyes = filtrees.filter((d) => d.statut === "envoye").length;
  const taux = envoyes + acceptes > 0 ? Math.round((acceptes / (envoyes + acceptes)) * 100) : 0;

  return (
    <div className="space-y-6">
      <p className="-mt-4 text-sm text-muted-foreground">
        {filtrees.length} devis — {total.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} cumulés
        {envoyes + acceptes > 0 && (
          <>
            {" "}· taux d&apos;acceptation : <strong>{taux}%</strong>
          </>
        )}
      </p>
      <DevisToolbar filtres={filtres} onChange={setFiltres} />
      <DevisTable devis={filtrees} />
    </div>
  );
}
