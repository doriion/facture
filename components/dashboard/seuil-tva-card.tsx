import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEuros } from "@/lib/format";

/**
 * Suivi du seuil de franchise TVA — CRITIQUE pour un auto-entrepreneur.
 * En cas de dépassement, l'utilisateur sort de la franchise et doit
 * facturer la TVA + déclarer.
 *
 * Alertes :
 * - <80% : vert, RAS
 * - 80-89% : amber, attention
 * - 90-99% : orange, vigilance forte
 * - ≥100% : rouge, seuil dépassé — actions requises
 */
export function SeuilTvaCard({
  caCalendrierAnnee,
  seuilTva,
  pourcentageSeuilTva,
  annee,
}: {
  caCalendrierAnnee: number;
  seuilTva: number;
  pourcentageSeuilTva: number;
  annee: number;
}) {
  const restant = Math.max(0, seuilTva - caCalendrierAnnee);
  const depasse = caCalendrierAnnee > seuilTva;

  let tone: "ok" | "warn" | "danger" | "critical";
  if (pourcentageSeuilTva >= 100) tone = "critical";
  else if (pourcentageSeuilTva >= 90) tone = "danger";
  else if (pourcentageSeuilTva >= 80) tone = "warn";
  else tone = "ok";

  const colors = {
    ok: {
      bar: "bg-primary",
      bg: "bg-primary/5",
      border: "border-primary/30",
      text: "text-primary",
      icon: Info,
    },
    warn: {
      bar: "bg-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-300 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-300",
      icon: AlertTriangle,
    },
    danger: {
      bar: "bg-orange-500",
      bg: "bg-orange-50 dark:bg-orange-950/30",
      border: "border-orange-300 dark:border-orange-800",
      text: "text-orange-700 dark:text-orange-300",
      icon: AlertTriangle,
    },
    critical: {
      bar: "bg-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/40",
      text: "text-destructive",
      icon: ShieldAlert,
    },
  };
  const c = colors[tone];
  const Icon = c.icon;

  return (
    <Card className={`${c.bg} ${c.border}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Icon className={`size-5 shrink-0 ${c.text}`} />
          <div className="flex-1">
            <CardTitle className="text-base">
              Seuil de franchise TVA — {annee}
            </CardTitle>
            <CardDescription>
              Article L.223-3 du CIBS · prestations de services et BTP
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {formatEuros(caCalendrierAnnee)}
            </p>
            <p className="text-xs text-muted-foreground">
              sur un seuil de {formatEuros(seuilTva)}
            </p>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${c.text}`}>
            {pourcentageSeuilTva}%
          </p>
        </div>

        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${c.bar}`}
            style={{ width: `${Math.min(100, pourcentageSeuilTva)}%` }}
          />
          {/* Repères 80% et 90% */}
          <div className="absolute left-[80%] top-0 h-full w-px bg-foreground/30" />
          <div className="absolute left-[90%] top-0 h-full w-px bg-foreground/30" />
        </div>

        <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>0</span>
          <span>80% ({formatEuros(seuilTva * 0.8)})</span>
          <span>90%</span>
          <span>{formatEuros(seuilTva)}</span>
        </div>

        {tone === "ok" && (
          <p className="text-sm text-muted-foreground">
            Il vous reste <strong>{formatEuros(restant)}</strong> avant le
            seuil. Restez en franchise de TVA.
          </p>
        )}
        {tone === "warn" && (
          <p className={`text-sm font-medium ${c.text}`}>
            ⚠ Vous avez dépassé 80% du seuil. Il vous reste{" "}
            {formatEuros(restant)} — anticipez la sortie de franchise.
          </p>
        )}
        {tone === "danger" && (
          <p className={`text-sm font-medium ${c.text}`}>
            ⚠ 90% atteint. Limitez les factures jusqu'à fin {annee} ou
            préparez votre passage au régime TVA pour {annee + 1}.
          </p>
        )}
        {tone === "critical" && (
          <p className={`text-sm font-medium ${c.text}`}>
            Seuil dépassé{depasse ? ` de ${formatEuros(caCalendrierAnnee - seuilTva)}` : ""}.
            Vous sortez de la franchise de TVA. Les factures suivantes
            doivent porter la TVA — modifiez vos mentions légales et
            déclarez auprès du SIE.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
