"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEuros } from "@/lib/format";
import { COULEURS_GRAPHIQUES } from "@/lib/theme";

// Même ordre que le graphique de CA mensuel : une activité garde la
// même couleur d'un graphique à l'autre du tableau de bord.
const COLORS_BY_ACTIVITE: Record<string, string> = {
  plomberie: COULEURS_GRAPHIQUES[0],
  installation_clim: COULEURS_GRAPHIQUES[1],
  installation_pac: COULEURS_GRAPHIQUES[2],
  entretien: COULEURS_GRAPHIQUES[3],
  depannage: COULEURS_GRAPHIQUES[4],
  autre: COULEURS_GRAPHIQUES[5],
};

export function RepartitionActiviteChart({
  data,
  annee,
}: {
  data: Array<{ activite: string; libelle: string; montant: number }>;
  annee: number;
}) {
  const total = data.reduce((sum, d) => sum + d.montant, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition par activité</CardTitle>
        <CardDescription>Année {annee}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
            Aucune donnée à afficher.
          </div>
        ) : (
          <>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="montant"
                    nameKey="libelle"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.activite}
                        fill={
                          COLORS_BY_ACTIVITE[entry.activite] ??
                          COLORS_BY_ACTIVITE.autre
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatEuros(Number(value ?? 0))}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              {data.map((d) => {
                const pct = total > 0 ? Math.round((d.montant / total) * 100) : 0;
                return (
                  <div
                    key={d.activite}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-sm"
                        style={{
                          backgroundColor:
                            COLORS_BY_ACTIVITE[d.activite] ??
                            COLORS_BY_ACTIVITE.autre,
                        }}
                      />
                      <span>{d.libelle}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium tabular-nums">
                        {formatEuros(d.montant)}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
