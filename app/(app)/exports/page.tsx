import {
  buildExportUrssaf,
  getExportPeriodes,
} from "@/lib/actions/export-urssaf";
import { ExportUrssafTable } from "@/components/exports/export-urssaf-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Export comptable — Facture AE" };

export const dynamic = "force-dynamic";

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string; label?: string };
}) {
  const periodes = getExportPeriodes();

  // Période par défaut = trimestre en cours
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const defaultPeriode =
    periodes.find((p) => p.label === `T${currentQuarter} ${now.getFullYear()}`) ??
    periodes[0];

  const selected = (() => {
    if (searchParams.start && searchParams.end) {
      return {
        label: searchParams.label ?? "",
        start: searchParams.start,
        end: searchParams.end,
      };
    }
    return defaultPeriode;
  })();

  const summary = await buildExportUrssaf(selected.start, selected.end);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Export comptable / URSSAF
        </h1>
        <p className="text-sm text-muted-foreground">
          Recettes encaissées sur la période — base de la déclaration de
          chiffre d'affaires URSSAF (régime micro-entrepreneur).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Période</CardTitle>
          <CardDescription>
            Sélectionnez le trimestre ou l'année à exporter. L'export se
            base sur la <strong>date d'encaissement</strong> des paiements,
            pas sur la date d'émission des factures (logique URSSAF).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportUrssafTable
            periodes={periodes}
            selected={selected}
            summary={summary}
          />
        </CardContent>
      </Card>
    </div>
  );
}
