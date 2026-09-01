import { getTaches } from "@/lib/actions/taches";
import { TachesListe, type VueTaches } from "@/components/taches/taches-liste";
import {
  TacheQuickAdd,
  type PrefillTache,
} from "@/components/taches/tache-quick-add";

export const metadata = { title: "À faire — Facture AE" };

/**
 * Le pense-bête : trois vues (Aujourd'hui / À venir / Faites) pilotées
 * par ?vue=, saisie éclair via le bouton flottant (composant client).
 * ?ajouter=1 (+ lien pré-rempli) ouvre directement le tiroir de
 * création — c'est ce qu'utilisent les boutons « Ajouter une tâche »
 * des fiches client / intervention / devis / facture.
 */
export default async function TachesPage({
  searchParams,
}: {
  searchParams: {
    vue?: string;
    search?: string;
    ajouter?: string;
    titre?: string;
    lien_label?: string;
    client_id?: string;
    intervention_id?: string;
    devis_id?: string;
    facture_id?: string;
  };
}) {
  const taches = await getTaches();
  const vue: VueTaches =
    searchParams.vue === "avenir" || searchParams.vue === "faites"
      ? searchParams.vue
      : "aujourdhui";

  const prefill: PrefillTache = {
    titre: searchParams.titre,
    lienLabel: searchParams.lien_label,
    client_id: searchParams.client_id,
    intervention_id: searchParams.intervention_id,
    devis_id: searchParams.devis_id,
    facture_id: searchParams.facture_id,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            À faire
          </h1>
          <p className="text-sm text-muted-foreground">
            Votre pense-bête : notez, photographiez, cochez.
          </p>
        </div>
        <TacheQuickAdd
          key={searchParams.ajouter === "1" ? "prefill" : "normal"}
          prefill={prefill}
          ouvrirAuChargement={searchParams.ajouter === "1"}
        />
      </div>

      <TachesListe taches={taches} vue={vue} recherche={searchParams.search} />
    </div>
  );
}
