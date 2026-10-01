import Link from "next/link";
import { Landmark } from "lucide-react";

import type { RappelDeclarationUrssaf } from "@/lib/actions/declarations";
import { formatDateFr, formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Rappel de la déclaration de chiffre d'affaires : période échue non
 * déclarée, montant encaissé à recopier, date limite. Le bouton ouvre
 * la page Exports sur cette période, où l'on marque « déclarée ».
 */
export function DeclarationRappelCard({ rappel }: { rappel: RappelDeclarationUrssaf | null }) {
  if (!rappel) return null;
  const enRetard = rappel.joursRestants < 0;
  const href = `/exports?start=${rappel.start}&end=${rappel.end}&label=${encodeURIComponent(rappel.label)}`;

  return (
    <Card
      className={
        enRetard
          ? "border-rose-500/50 bg-rose-50 dark:bg-rose-950/30"
          : "border-amber-500/50 bg-amber-50 dark:bg-amber-950/30"
      }
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <Landmark className={`mt-0.5 size-5 shrink-0 ${enRetard ? "text-rose-600" : "text-amber-600"}`} />
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              Déclaration URSSAF {rappel.label} : {formatEuros(rappel.montant)} encaissés
            </p>
            <p className="text-muted-foreground">
              {enRetard
                ? `Date limite dépassée depuis ${-rappel.joursRestants} jour${-rappel.joursRestants > 1 ? "s" : ""} (${formatDateFr(rappel.dateLimite)}).`
                : `À déclarer avant le ${formatDateFr(rappel.dateLimite)}${
                    rappel.joursRestants === 0
                      ? ", c'est aujourd'hui."
                      : ` (dans ${rappel.joursRestants} jour${rappel.joursRestants > 1 ? "s" : ""}).`
                  }`}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant={enRetard ? "destructive" : "default"}>
          <Link href={href}>Préparer la déclaration</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
