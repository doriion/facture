"use client";

import dynamic from "next/dynamic";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Les deux graphiques du tableau de bord embarquent Recharts (~150 ko
 * gzip). Chargés à part et après le reste de la page : les chiffres,
 * les alertes et les actions s'affichent d'abord, le graphique arrive
 * ensuite à la place de son squelette. Sans rendu serveur : Recharts
 * mesure son conteneur dans le navigateur, le HTML serveur était vide
 * de toute façon.
 */
function Squelette({ hauteur }: { hauteur: string }) {
  return (
    <Card aria-busy="true">
      <CardHeader className="space-y-2">
        <div className="h-5 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted" />
      </CardHeader>
      <CardContent>
        <div className={`${hauteur} animate-pulse rounded-md bg-muted/60`} />
      </CardContent>
    </Card>
  );
}

export const CaMensuelChart = dynamic(
  () =>
    import("@/components/dashboard/ca-mensuel-chart").then(
      (m) => m.CaMensuelChart,
    ),
  { ssr: false, loading: () => <Squelette hauteur="h-64" /> },
);

export const RepartitionActiviteChart = dynamic(
  () =>
    import("@/components/dashboard/repartition-activite-chart").then(
      (m) => m.RepartitionActiviteChart,
    ),
  { ssr: false, loading: () => <Squelette hauteur="h-56" /> },
);
