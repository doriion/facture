"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEuros } from "@/lib/format";

type Bucket = {
  mois: string;
  plomberie: number;
  clim: number;
  pac: number;
  entretien: number;
  depannage: number;
  autre: number;
  total: number;
};

const seriesConfig = [
  { dataKey: "plomberie", name: "Plomberie", color: "#2A7D5B" },
  { dataKey: "clim", name: "Clim", color: "#5B9BD5" },
  { dataKey: "pac", name: "PAC", color: "#264478" },
  { dataKey: "entretien", name: "Entretien", color: "#9E480E" },
  { dataKey: "depannage", name: "Dépannage", color: "#E97132" },
  { dataKey: "autre", name: "Autre", color: "#A5A5A5" },
] as const;

export function CaMensuelChart({ data }: { data: Bucket[] }) {
  const totalGeneral = data.reduce((sum, d) => sum + d.total, 0);
  const moyenne = data.length ? totalGeneral / data.length : 0;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Chiffre d'affaires mensuel</CardTitle>
        <CardDescription>
          12 derniers mois — ventilé par type d'activité · moyenne ≈{" "}
          {formatEuros(moyenne)}/mois
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="mois"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                // Sur 380px de large, les 12 étiquettes de mois se
                // chevauchent : on laisse recharts en sauter (écart
                // mini 12px) plutôt que de compresser.
                minTickGap={12}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                }
                width={40}
              />
              <Tooltip
                cursor={{ fill: "rgba(42, 125, 91, 0.06)" }}
                formatter={(value, name) => [
                  formatEuros(Number(value ?? 0)),
                  String(name),
                ]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
              {seriesConfig.map((s) => (
                <Bar
                  key={s.dataKey}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color}
                  stackId="ca"
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
