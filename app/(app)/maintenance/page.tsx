import Link from "next/link";
import { CalendarCheck, CalendarClock, Plus } from "lucide-react";

import {
  listContrats,
  prochainesVisites,
  visitesAConvenir,
} from "@/lib/actions/contrats";
import { PlanifierVisiteDialog } from "@/components/maintenance/planifier-visite-dialog";
import { confirmationValable, heureLisible } from "@/lib/visite-entretien";
import { synchroniserEcheancierContrats } from "@/lib/actions/contrats-entretien";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContratsTable } from "@/components/maintenance/contrats-table";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { formatDateFr } from "@/lib/format";
import { aujourdhuiParis } from "@/lib/dates";

export const metadata = { title: "Échéancier des visites — NG Gestion" };

export default async function MaintenancePage() {
  // Contrats signés déjà actifs mais pas encore reliés à l'échéancier.
  await synchroniserEcheancierContrats();
  const [contrats, prochaines, aConvenir] = await Promise.all([
    listContrats(),
    prochainesVisites(60),
    visitesAConvenir(),
  ]);

  // Heure de Paris : entre 0 h et 2 h, la date UTC est encore la veille.
  const today = aujourdhuiParis();
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
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Échéancier des visites
          </h1>
          <p className="text-sm text-muted-foreground">
            Visites d&apos;entretien récurrentes (annuelles, semestrielles ou
            trimestrielles) — la facture se génère à chaque visite en 1 clic.
            Les contrats signés sont dans « Contrats d&apos;entretien ».
          </p>
        </div>
        <Button asChild className="max-md:hidden">
          <Link href="/maintenance/nouveau">
            <Plus className="size-4" />
            Nouveau contrat
          </Link>
        </Button>
      </div>

      {aConvenir.length > 0 && (
        <Card className="border-orange-300 dark:border-orange-700">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="size-4 text-orange-600 dark:text-orange-300" />
              Visites à convenir avec le client
            </CardTitle>
            <CardDescription>
              Contrats actifs sans date de visite : fixez-la avec le client,
              la confirmation part par e-mail en même temps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {aConvenir.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-orange-200 bg-orange-50/60 px-3 py-2 text-sm dark:border-orange-800 dark:bg-orange-950/30"
              >
                <Link href={`/maintenance/${v.id}`} className="min-w-0 hover:underline">
                  <span className="font-medium">{v.client?.nom ?? "Client"}</span>
                  {v.intitule && (
                    <span className="text-muted-foreground"> · {v.intitule}</span>
                  )}
                </Link>
                <PlanifierVisiteDialog
                  contratId={v.id}
                  clientNom={v.client?.nom ?? null}
                  clientEmail={v.client?.email ?? null}
                  prochaineVisite={null}
                  prochaineVisiteHeure={null}
                  confirmationEnvoyeePour={null}
                  trigger={
                    <Button size="sm">
                      <CalendarCheck className="size-4" />
                      Planifier la visite
                    </Button>
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                <span className="text-right">
                  <span className="font-medium">
                    {formatDateFr(v.prochaine_visite!)}
                    {v.prochaine_visite_heure ? ` à ${heureLisible(v.prochaine_visite_heure)}` : ""}
                  </span>
                  <span
                    className={`block text-xs ${confirmationValable(v) ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}
                  >
                    {confirmationValable(v) ? "Confirmée au client" : "Non confirmée"}
                  </span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <ContratsTable contrats={contrats} />

      <MobileActionBar>
        <Button asChild size="lg">
          <Link href="/maintenance/nouveau">
            <Plus className="size-4" />
            Nouveau contrat
          </Link>
        </Button>
      </MobileActionBar>
    </div>
  );
}
