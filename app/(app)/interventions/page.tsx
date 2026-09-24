import Link from "next/link";
import { Plus, Receipt, Trash2 } from "lucide-react";

import { bilanFluidesFrigo, listCorbeille, listInterventions } from "@/lib/actions/interventions";
import { Button } from "@/components/ui/button";
import { InterventionsListe } from "@/components/interventions/interventions-liste";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aujourdhuiParis } from "@/lib/dates";
import { compterStatuts } from "@/lib/interventions-helpers";

export const metadata = { title: "Interventions — NG Gestion" };

export default async function InterventionsPage({
  searchParams,
}: {
  searchParams: { search?: string; type?: string; statut?: string };
}) {
  const search = searchParams.search ?? "";
  const type = searchParams.type ?? "";
  const statut = searchParams.statut ?? "";

  const [interventions, bilan, corbeille] = await Promise.all([
    // Liste entière : recherche et filtre sur place (InterventionsListe).
    listInterventions(),
    bilanFluidesFrigo(),
    listCorbeille(),
  ]);

  const bilanEntries = Object.entries(bilan.bilan);
  const compteurs = compterStatuts(interventions, aujourdhuiParis());

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
        <div className="flex flex-wrap items-center gap-2">
          {corbeille.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/interventions/corbeille">
                <Trash2 className="size-4" />
                Corbeille ({corbeille.length})
              </Link>
            </Button>
          )}
          <Button asChild className="max-md:hidden">
            <Link href="/interventions/nouvelle">
              <Plus className="size-4" />
              Nouvelle intervention
            </Link>
          </Button>
        </div>
      </div>

      {compteurs.a_facturer > 0 && (
        <Link
          href="/interventions?statut=a_facturer"
          className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        >
          <Receipt className="size-4 shrink-0" />
          <span>
            <strong>{compteurs.a_facturer}</strong> intervention{compteurs.a_facturer > 1 ? "s" : ""} passée
            {compteurs.a_facturer > 1 ? "s" : ""} à facturer
          </span>
        </Link>
      )}

      <InterventionsListe interventions={interventions} initial={{ search, type, statut }} />

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
