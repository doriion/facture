import Link from "next/link";
import { ArrowLeft, Bookmark } from "lucide-react";

import { listModelesDevis } from "@/lib/actions/devis";
import { Button } from "@/components/ui/button";
import { ModelesDevisSection } from "@/components/devis/modeles-devis-section";

export const metadata = { title: "Mes modèles de devis — NG Gestion" };

/**
 * Gestion des modèles de devis (renommer, supprimer, retirer, créer un
 * devis depuis). Page discrète, atteinte depuis le menu « Nouveau
 * depuis un modèle » → « Gérer mes modèles » : la liste des devis n'en
 * porte plus la carte en permanence.
 */
export default async function ModelesDevisPage() {
  const modeles = await listModelesDevis();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/devis">
            <ArrowLeft className="size-4" />
            Retour aux devis
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Mes modèles de devis
        </h1>
        <p className="text-sm text-muted-foreground">
          Renommez, supprimez ou repartez d&apos;un modèle. Pour en créer un :
          ouvrez un devis puis « Enregistrer comme modèle ».
        </p>
      </div>

      {modeles.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <Bookmark className="mx-auto mb-3 size-6 text-primary" />
          <p>Aucun modèle pour l&apos;instant.</p>
          <p className="mt-1">
            Ouvrez un devis et cliquez « Enregistrer comme modèle ».
          </p>
        </div>
      ) : (
        <ModelesDevisSection modeles={modeles} />
      )}
    </div>
  );
}
