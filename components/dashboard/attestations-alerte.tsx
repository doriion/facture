import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import type { DashboardData } from "@/lib/actions/dashboard";
import { formatDateFr } from "@/lib/format";

/**
 * Bandeau d'alerte sur les attestations qui expirent (décennale,
 * capacité fluides) : ambre à J-30, rouge une fois l'échéance dépassée
 * (travailler sans décennale valide = interdit en BTP).
 */
export function AttestationsAlerte({
  attestations,
}: {
  attestations: DashboardData["attestations"];
}) {
  if (attestations.length === 0) return null;

  return (
    <div className="space-y-2">
      {attestations.map((a) => {
        const expiree = a.alerte.niveau === "expiree";
        return (
          <div
            key={a.label}
            className={
              expiree
                ? "flex items-start gap-2 rounded-md border border-red-600/50 bg-red-500/10 p-3 text-sm"
                : "flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-3 text-sm"
            }
          >
            <ShieldAlert
              className={
                expiree
                  ? "mt-0.5 size-4 shrink-0 text-red-600"
                  : "mt-0.5 size-4 shrink-0 text-amber-600"
              }
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {expiree
                  ? `${a.label} EXPIRÉE depuis le ${formatDateFr(a.dateFin)} (${a.alerte.jours} j)`
                  : `${a.label} à renouveler avant le ${formatDateFr(a.dateFin)} (J-${a.alerte.jours})`}
              </p>
              <p className="text-xs text-muted-foreground">
                {expiree
                  ? "Intervenir sans attestation valide vous expose — renouvelez puis mettez à jour la date dans Paramètres."
                  : "Pensez au renouvellement, puis mettez à jour la date dans "}
                {!expiree && (
                  <Link
                    href="/parametres"
                    className="underline underline-offset-2"
                  >
                    Paramètres
                  </Link>
                )}
                {!expiree && "."}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
