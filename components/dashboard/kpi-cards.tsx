import {
  ArrowDown,
  ArrowUp,
  Euro,
  FileSignature,
  FileText,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEuros } from "@/lib/format";

/**
 * Cards KPI principales en haut du dashboard.
 */
export function KpiCards({
  caMois,
  caEncaisseMois,
  caMoisPrecedent,
  caAnnee,
  nbFacturesImpayees,
  montantImpaye,
  nbDevisEnAttente,
  tauxConversionDevis,
  annee,
}: {
  caMois: number;
  caEncaisseMois: number;
  caMoisPrecedent: number;
  caAnnee: number;
  nbFacturesImpayees: number;
  montantImpaye: number;
  nbDevisEnAttente: number;
  tauxConversionDevis: number | null;
  annee: number;
}) {
  const evolutionMois =
    caMoisPrecedent > 0
      ? Math.round(((caMois - caMoisPrecedent) / caMoisPrecedent) * 100)
      : null;
  const evolutionPositive = evolutionMois !== null && evolutionMois >= 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      {/* LE chiffre de trésorerie du quotidien : ce qui est réellement
          rentré ce mois-ci (somme des paiements, même source que
          l'URSSAF) — mis en avant, pleine largeur sur mobile. */}
      <Card className="col-span-2 border-primary bg-primary/5 lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium sm:text-sm">
            Encaissé ce mois
          </CardTitle>
          <Wallet className="size-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums sm:text-2xl">
            {formatEuros(caEncaisseMois)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Paiements reçus — base URSSAF
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
            Facturé ce mois
          </CardTitle>
          <Euro className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums sm:text-2xl">
            {formatEuros(caMois)}
          </div>
          {evolutionMois !== null ? (
            <p
              className={`mt-1 flex items-center gap-1 text-xs ${
                evolutionPositive ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {evolutionPositive ? (
                <ArrowUp className="size-3" />
              ) : (
                <ArrowDown className="size-3" />
              )}
              {evolutionPositive ? "+" : ""}
              {evolutionMois}% vs mois précédent
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Émis, hors brouillons
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
            Facturé {annee}
          </CardTitle>
          <TrendingUp className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums sm:text-2xl">
            {formatEuros(caAnnee)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Émis, hors annulées — l'URSSAF se déclare sur l'encaissé
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
            Factures impayées
          </CardTitle>
          <FileText className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums sm:text-2xl">
            {nbFacturesImpayees}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatEuros(montantImpaye)} à recouvrer
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
            Devis en attente
          </CardTitle>
          <FileSignature className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold tabular-nums sm:text-2xl">
            {nbDevisEnAttente}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Taux d'acceptation :{" "}
            <strong>
              {tauxConversionDevis === null ? "—" : `${tauxConversionDevis}%`}
            </strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
