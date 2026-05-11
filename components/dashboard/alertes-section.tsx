import Link from "next/link";
import { AlertCircle, CalendarClock, Clock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateFr, formatEuros } from "@/lib/format";

type Props = {
  facturesEnRetard: Array<{
    id: string;
    numero: string;
    date_echeance: string;
    total_ht: number;
    client_nom: string | null;
    joursRetard: number;
  }>;
  devisExpirantBientot: Array<{
    id: string;
    numero: string;
    date_validite: string;
    total_ht: number;
    client_nom: string | null;
    joursAvantExpiration: number;
  }>;
  prochainesVisitesMaintenance: Array<{
    id: string;
    prochaine_visite: string;
    intitule: string | null;
    client_nom: string | null;
  }>;
};

export function AlertesSection({
  facturesEnRetard,
  devisExpirantBientot,
  prochainesVisitesMaintenance,
}: Props) {
  const hasAny =
    facturesEnRetard.length > 0 ||
    devisExpirantBientot.length > 0 ||
    prochainesVisitesMaintenance.length > 0;

  if (!hasAny) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">À surveiller</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tout est sous contrôle — aucune facture en retard, aucun devis
            sur le point d'expirer, aucune visite maintenance imminente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {facturesEnRetard.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="size-4 text-destructive" />
              Factures en retard
            </CardTitle>
            <CardDescription>{facturesEnRetard.length} à recouvrer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {facturesEnRetard.map((f) => (
              <Link
                key={f.id}
                href={`/factures/${f.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-destructive/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-medium">
                    {f.numero}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.client_nom ?? "—"} · échéance{" "}
                    {formatDateFr(f.date_echeance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">
                    {formatEuros(f.total_ht)}
                  </p>
                  <p className="text-xs text-destructive">
                    +{f.joursRetard}j
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {devisExpirantBientot.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-amber-600 dark:text-amber-400" />
              Devis expirant bientôt
            </CardTitle>
            <CardDescription>Sous 15 jours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {devisExpirantBientot.map((d) => (
              <Link
                key={d.id}
                href={`/devis/${d.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-amber-100/60 dark:hover:bg-amber-900/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-medium">
                    {d.numero}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.client_nom ?? "—"} · valide jusqu'au{" "}
                    {formatDateFr(d.date_validite)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">
                    {formatEuros(d.total_ht)}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    J−{d.joursAvantExpiration}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {prochainesVisitesMaintenance.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" />
              Visites maintenance
            </CardTitle>
            <CardDescription>30 prochains jours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {prochainesVisitesMaintenance.map((v) => (
              <Link
                key={v.id}
                href={`/maintenance/${v.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {v.client_nom ?? "—"}
                  </p>
                  {v.intitule && (
                    <p className="truncate text-xs text-muted-foreground">
                      {v.intitule}
                    </p>
                  )}
                </div>
                <p className="text-xs font-medium tabular-nums">
                  {formatDateFr(v.prochaine_visite)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
