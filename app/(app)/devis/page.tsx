import Link from "next/link";
import { Plus } from "lucide-react";

import { listDevis, listModelesDevis } from "@/lib/actions/devis";
import { Button } from "@/components/ui/button";
import { DevisListe } from "@/components/devis/devis-liste";
import { NouveauDepuisModeleMenu } from "@/components/devis/nouveau-depuis-modele-menu";
import { MobileActionBar } from "@/components/mobile-action-bar";

export const metadata = { title: "Devis — NG Gestion" };

export default async function DevisPage({
  searchParams,
}: {
  searchParams: { search?: string; statut?: string; type?: string };
}) {
  const search = searchParams.search ?? "";
  const statut = searchParams.statut ?? "";
  const type = searchParams.type ?? "";

  // Liste entière : la recherche et les filtres s'appliquent sur le
  // téléphone (DevisListe), sans aller-retour serveur.
  const [devis, modeles] = await Promise.all([listDevis(), listModelesDevis()]);

  // Le menu ne reçoit que ce qui sert à lister par nom.
  const modelesMenu = modeles.map((m) => ({
    id: m.id,
    numero: m.numero,
    nom_modele: m.nom_modele,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Devis</h1>
        </div>
        <div className="flex items-center gap-2 max-md:hidden">
          <NouveauDepuisModeleMenu modeles={modelesMenu} />
          <Button asChild>
            <Link href="/devis/nouveau">
              <Plus className="size-4" />
              Nouveau devis
            </Link>
          </Button>
        </div>
      </div>

      {/* La gestion des modèles (renommer, supprimer) vit sur
          /devis/modeles, via « Gérer mes modèles » dans le menu :
          la liste des devis reste dégagée au quotidien. */}
      <DevisListe devis={devis} initial={{ search, statut, type }} />

      <MobileActionBar>
        <NouveauDepuisModeleMenu
          modeles={modelesMenu}
          size="lg"
          className="px-3"
          libelle="Depuis un modèle"
        />
        <Button asChild size="lg">
          <Link href="/devis/nouveau">
            <Plus className="size-4" />
            Nouveau devis
          </Link>
        </Button>
      </MobileActionBar>
    </div>
  );
}
