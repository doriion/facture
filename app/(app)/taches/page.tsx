import { getTaches } from "@/lib/actions/taches";
import { TachesListe, type VueTaches } from "@/components/taches/taches-liste";

export const metadata = { title: "À faire — Facture AE" };

/**
 * Le pense-bête : trois vues (Aujourd'hui / À venir / Faites) pilotées
 * par ?vue=, saisie éclair via le bouton flottant (composant client).
 */
export default async function TachesPage({
  searchParams,
}: {
  searchParams: { vue?: string; search?: string };
}) {
  const taches = await getTaches();
  const vue: VueTaches =
    searchParams.vue === "avenir" || searchParams.vue === "faites"
      ? searchParams.vue
      : "aujourdhui";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          À faire
        </h1>
        <p className="text-sm text-muted-foreground">
          Votre pense-bête : notez, photographiez, cochez.
        </p>
      </div>

      <TachesListe taches={taches} vue={vue} recherche={searchParams.search} />
    </div>
  );
}
