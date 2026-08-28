import { AlertTriangle, PiggyBank } from "lucide-react";
import Link from "next/link";

import type { DashboardData } from "@/lib/actions/dashboard";
import { formatDateFr, formatEuros } from "@/lib/format";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * « Cotisations à provisionner » : estimation sur l'ENCAISSÉ du
 * trimestre en cours, au barème daté de la table taux_cotisations
 * (ACRE puis taux plein). Avertit dans les 6 mois qui précèdent une
 * hausse de taux — à CA égal, la provision change brutalement.
 */
export function CotisationsCard({
  cotisations,
}: {
  cotisations: DashboardData["cotisations"];
}) {
  const { trimestreLabel, encaisseTrimestre, provision, bascule } = cotisations;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Cotisations à provisionner — {trimestreLabel}
        </CardTitle>
        <PiggyBank className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {provision ? (
          <>
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {formatEuros(provision.montantTotal)}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {provision.tauxTotalPct.toLocaleString("fr-FR")} % de{" "}
                {formatEuros(encaisseTrimestre)} encaissés ce trimestre —{" "}
                {provision.taux.libelle}
              </p>
            </div>
            <dl className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>
                  Cotisations sociales (
                  {provision.taux.taux_social.toLocaleString("fr-FR")} %)
                </dt>
                <dd className="tabular-nums">
                  {formatEuros(provision.montantSocial)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>
                  Formation professionnelle (
                  {provision.taux.taux_cfp.toLocaleString("fr-FR")} %)
                </dt>
                <dd className="tabular-nums">
                  {formatEuros(provision.montantCfp)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>
                  Versement libératoire (
                  {provision.taux.taux_vl.toLocaleString("fr-FR")} %)
                </dt>
                <dd className="tabular-nums">
                  {formatEuros(provision.montantVl)}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun barème applicable à ce jour —{" "}
            <Link href="/parametres" className="underline underline-offset-2">
              vérifiez vos taux dans Paramètres
            </Link>
            .
          </p>
        )}

        {bascule && (
          <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-2.5 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              <strong>
                Fin de période ACRE le {formatDateFr(bascule.date)}
              </strong>{" "}
              : le taux global passe de{" "}
              {bascule.tauxAvantPct.toLocaleString("fr-FR")} % à{" "}
              {bascule.tauxApresPct.toLocaleString("fr-FR")} %. À chiffre
              d'affaires égal, la provision fait presque le double —
              anticipez sur la trésorerie.
            </p>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Estimation indicative sur l'encaissé (base URSSAF). Taux
          modifiables dans{" "}
          <Link href="/parametres" className="underline underline-offset-2">
            Paramètres
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
