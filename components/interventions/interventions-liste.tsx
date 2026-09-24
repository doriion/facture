"use client";

import { useMemo } from "react";

import { filtrerInterventions } from "@/lib/filtres-listes";
import { aujourdhuiParis } from "@/lib/dates";
import { InterventionsTable } from "@/components/interventions/interventions-table";
import {
  InterventionsToolbar,
  type FiltresInterventionsUi,
} from "@/components/interventions/interventions-toolbar";
import { useFiltresListe } from "@/components/liste-filtree";

type Intervention = React.ComponentProps<typeof InterventionsTable>["interventions"][number];

export function InterventionsListe({
  interventions,
  initial,
}: {
  interventions: Intervention[];
  initial: FiltresInterventionsUi;
}) {
  const [filtres, setFiltres] = useFiltresListe("/interventions", initial);
  const filtrees = useMemo(
    () => filtrerInterventions(interventions, filtres, aujourdhuiParis()),
    [interventions, filtres],
  );

  return (
    <div className="space-y-6">
      <InterventionsToolbar filtres={filtres} onChange={setFiltres} />
      <InterventionsTable interventions={filtrees} />
    </div>
  );
}
