import Link from "next/link";
import { Bookmark, FilePlus2, Plus } from "lucide-react";

import { listDevis, listModelesDevis } from "@/lib/actions/devis";
import { LABELS_TYPE_ACTIVITE } from "@/lib/legal-text";
import { formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DevisTable } from "@/components/devis/devis-table";
import { DevisToolbar } from "@/components/devis/devis-toolbar";

export const metadata = { title: "Devis — Facture AE" };

export default async function DevisPage({
  searchParams,
}: {
  searchParams: { search?: string; statut?: string; type?: string };
}) {
  const search = searchParams.search ?? "";
  const statut = searchParams.statut ?? "";
  const type = searchParams.type ?? "";

  const [devis, modeles] = await Promise.all([
    listDevis({ search, statut, type }),
    listModelesDevis(),
  ]);

  const totalAffiche = devis.reduce((sum, d) => sum + Number(d.total_ht), 0);
  const accepted = devis.filter((d) => d.statut === "accepte").length;
  const sent = devis.filter((d) => d.statut === "envoye").length;
  const conversionRate =
    sent + accepted > 0 ? Math.round((accepted / (sent + accepted)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Devis</h1>
          <p className="text-sm text-muted-foreground">
            {devis.length} devis —{" "}
            {totalAffiche.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
            })}{" "}
            HT cumulés
            {sent + accepted > 0 && (
              <>
                {" "}
                · taux d'acceptation : <strong>{conversionRate}%</strong>
              </>
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/devis/nouveau">
            <Plus className="size-4" />
            Nouveau devis
          </Link>
        </Button>
      </div>

      {modeles.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bookmark className="size-4 text-primary" />
              Modèles de devis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modeles.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col justify-between gap-3 rounded-md border bg-muted/30 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/devis/${m.id}`}
                      className="font-mono text-sm font-medium hover:underline"
                    >
                      {m.numero}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {LABELS_TYPE_ACTIVITE[
                        m.type_activite as keyof typeof LABELS_TYPE_ACTIVITE
                      ] ?? m.type_activite}{" "}
                      · {formatEuros(Number(m.total_ht))} HT
                    </p>
                    {m.notes && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {m.notes}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/devis/nouveau?source=${m.id}`}>
                      <FilePlus2 className="size-4" />
                      Nouveau devis depuis ce modèle
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Les modèles n&apos;apparaissent ni dans la liste ci-dessous, ni
              dans les statistiques. Pour créer un modèle : ouvrez un devis
              puis « Enregistrer comme modèle ».
            </p>
          </CardContent>
        </Card>
      )}

      <DevisToolbar
        initialSearch={search}
        initialStatut={statut}
        initialType={type}
      />

      <DevisTable devis={devis} />
    </div>
  );
}
