import Link from "next/link";
import { Plus } from "lucide-react";

import { listContratsEntretien } from "@/lib/actions/contrats-entretien";
import {
  ContratsEntretienListe,
  ContratsEntretienToolbar,
} from "@/components/contrats/contrats-entretien-liste";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Contrats d'entretien — Facture AE" };

/**
 * Liste des contrats d'entretien signables : filtres par statut,
 * recherche, création. Distinct de /maintenance (l'échéancier interne
 * des visites) — un contrat signé pourra y être relié.
 */
export default async function ContratsPage({
  searchParams,
}: {
  searchParams: { search?: string; statut?: string };
}) {
  const search = searchParams.search ?? "";
  const statut = searchParams.statut ?? "tous";
  const contrats = await listContratsEntretien({ search, statut });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Contrats d'entretien
          </h1>
          <p className="text-sm text-muted-foreground">
            Créez, envoyez et faites signer vos contrats en ligne.
          </p>
        </div>
        <Button asChild className="max-md:hidden">
          <Link href="/contrats/nouveau">
            <Plus className="size-4" />
            Nouveau contrat
          </Link>
        </Button>
      </div>

      <ContratsEntretienToolbar
        initialSearch={search}
        initialStatut={statut}
      />

      <ContratsEntretienListe contrats={contrats} />

      <MobileActionBar>
        <Button asChild size="lg">
          <Link href="/contrats/nouveau">
            <Plus className="size-4" />
            Nouveau contrat
          </Link>
        </Button>
      </MobileActionBar>
    </div>
  );
}
