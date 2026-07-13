import Link from "next/link";
import { Plus } from "lucide-react";

import { bilanFluidesFrigo, listInterventions } from "@/lib/actions/interventions";
import { Button } from "@/components/ui/button";
import { InterventionsTable } from "@/components/interventions/interventions-table";
import { InterventionsToolbar } from "@/components/interventions/interventions-toolbar";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Interventions — Facture AE" };

export default async function InterventionsPage({
  searchParams,
}: {
  searchParams: { search?: string; type?: string };
}) {
  const search = searchParams.search ?? "";
  const type = searchParams.type ?? "";

  const [interventions, bilan] = await Promise.all([
    listInterventions({ search, type }),
    bilanFluidesFrigo(),
  ]);

  const bilanEntries = Object.entries(bilan.bilan);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Interventions</h1>
          <p className="text-sm text-muted-foreground">
            Suivi des chantiers, dépannages et entretiens. Les fluides
            frigorigènes sont consignés pour la déclaration F-Gas.
          </p>
        </div>
        <Button asChild className="max-md:hidden">
          <Link href="/interventions/nouvelle">
            <Plus className="size-4" />
            Nouvelle intervention
          </Link>
        </Button>
      </div>

      {bilanEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Bilan fluides frigorigènes — {bilan.annee}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {bilanEntries.map(([fluide, b]) => (
                <div
                  key={fluide}
                  className="rounded-md border bg-muted/30 px-4 py-3 text-sm"
                >
                  <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    {fluide}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Ajouté</span>
                      <p className="font-medium tabular-nums">
                        +{b.ajoute.toFixed(3)} kg
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Récupéré</span>
                      <p className="font-medium tabular-nums">
                        −{b.recupere.toFixed(3)} kg
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <InterventionsToolbar initialSearch={search} initialType={type} />
      <InterventionsTable interventions={interventions} />

      <MobileActionBar>
        <Button asChild size="lg">
          <Link href="/interventions/nouvelle">
            <Plus className="size-4" />
            Nouvelle intervention
          </Link>
        </Button>
      </MobileActionBar>
    </div>
  );
}
