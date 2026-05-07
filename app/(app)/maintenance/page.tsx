import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";

import {
  listContrats,
  prochainesVisites,
} from "@/lib/actions/contrats";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContratsTable } from "@/components/maintenance/contrats-table";
import { formatDateFr } from "@/lib/format";

export const metadata = { title: "Maintenance — Facture AE" };

export default async function MaintenancePage() {
  const [contrats, prochaines] = await Promise.all([
    listContrats(),
    prochainesVisites(60),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const enRetard = prochaines.filter(
    (v) => v.prochaine_visite && v.prochaine_visite < today,
  );
  const aVenir = prochaines.filter(
    (v) => v.prochaine_visite && v.prochaine_visite >= today,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Contrats de maintenance
          </h1>
          <p className="text-sm text-muted-foreground">
            Contrats récurrents annuels, semestriels ou trimestriels — la
            facture peut être générée à chaque visite en 1 clic.
          </p>
        </div>
        <Button asChild>
          <Link href="/maintenance/nouveau">
            <Plus className="size-4" />
            Nouveau contrat
          </Link>
        </Button>
      </div>

      {(enRetard.length > 0 || aVenir.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-primary" />
              Visites à programmer
            </CardTitle>
            <CardDescription>
              Sur les 60 prochains jours, sur les contrats actifs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {enRetard.map((v) => (
              <Link
                key={v.id}
                href={`/maintenance/${v.id}`}
                className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm hover:bg-destructive/10"
              >
                <div>
                  <span className="font-medium text-destructive">
                    {v.client?.nom ?? "Client"}
                  </span>
                  {v.intitule && (
                    <span className="text-muted-foreground"> · {v.intitule}</span>
                  )}
                </div>
                <span className="font-medium text-destructive">
                  {formatDateFr(v.prochaine_visite!)} (en retard)
                </span>
              </Link>
            ))}
            {aVenir.map((v) => (
              <Link
                key={v.id}
                href={`/maintenance/${v.id}`}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60"
              >
                <div>
                  <span className="font-medium">
                    {v.client?.nom ?? "Client"}
                  </span>
                  {v.intitule && (
                    <span className="text-muted-foreground"> · {v.intitule}</span>
                  )}
                </div>
                <span className="font-medium">
                  {formatDateFr(v.prochaine_visite!)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <ContratsTable contrats={contrats} />
    </div>
  );
}
