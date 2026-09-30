import { Check } from "lucide-react";

import {
  getAvailableEventsForFacture,
  getFactureCoveredEvents,
} from "@/lib/actions/facture-events-couverts";
import { FactureEventsCouverts } from "@/components/factures/facture-events-couverts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Section « Évènements couverts » chargée APRÈS le reste de la fiche
 * (dans un Suspense) : lister les RDV iPhone impose de télécharger et
 * d'analyser tout le calendrier externe côté serveur, ce qui retardait
 * l'affichage de la facture entière (numéro, lignes, paiements).
 */
export async function FactureEventsCouvertsSection({
  factureId,
  centerDate,
}: {
  factureId: string;
  centerDate: string;
}) {
  const [available, couverts] = await Promise.all([
    getAvailableEventsForFacture({ factureId, centerDate }),
    getFactureCoveredEvents(factureId),
  ]);
  return (
    <FactureEventsCouverts
      factureId={factureId}
      interventions={available.interventions}
      externals={available.externals}
      initialInterventionIds={couverts.interventionIds}
      initialExternalUids={couverts.externalUids}
    />
  );
}

/** Même en-tête que la section, le temps du chargement. */
export function FactureEventsCouvertsAttente() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Check className="size-4 text-primary" />
          Évènements couverts par cette facture
        </CardTitle>
        <CardDescription>
          Recherche des interventions et des RDV iPhone autour de la date de
          la facture…
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-9 animate-pulse rounded-md bg-muted" />
      </CardContent>
    </Card>
  );
}
