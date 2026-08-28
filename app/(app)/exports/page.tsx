import { buildExportUrssaf } from "@/lib/actions/export-urssaf";
import { getDeclaration } from "@/lib/actions/declarations";
import { getExportPeriodes } from "@/lib/exports/urssaf-helpers";
import { DeclarationUrssafCard } from "@/components/exports/declaration-urssaf-card";
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

  const [summary, declaration] = await Promise.all([
    buildExportUrssaf(selected.start, selected.end),
    getDeclaration(selected.start, selected.end),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Déclaration URSSAF / export comptable
        </h1>
        <p className="text-sm text-muted-foreground">
          Recettes encaissées sur la période — base de la déclaration de
          chiffre d'affaires URSSAF (régime micro-entrepreneur).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Déclaration {selected.label || "de la période"}
          </CardTitle>
          <CardDescription>
            Les montants à recopier dans les cases du formulaire, calculés
            sur la <strong>date d'encaissement</strong> des paiements (pas
            la date d'émission des factures).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeclarationUrssafCard
            periode={selected}
            totalEncaisse={summary.total_encaisse}
            ventilation={summary.ventilation}
            declaration={declaration}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail et export</CardTitle>
          <CardDescription>
            Les encaissements comptés dans la période, pour vérification,
            et le CSV à archiver ou transmettre.
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
