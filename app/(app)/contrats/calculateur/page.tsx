import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";

import { getBaremeEntretien } from "@/lib/actions/bareme-entretien";
import { CalculateurEntretien } from "@/components/entretien/calculateur-entretien";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Calculateur d'entretien — NG Gestion" };

/**
 * Calculateur seul, pour chiffrer vite (au téléphone avec un client).
 * Le même calculateur s'ouvre depuis un devis (« Calculer un
 * entretien ») et depuis un contrat, où il alimente directement le
 * document.
 */
export default async function CalculateurEntretienPage() {
  const bareme = await getBaremeEntretien();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
            <Link href="/contrats">
              <ArrowLeft className="size-4" />
              Retour aux contrats
            </Link>
          </Button>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Calculateur d&apos;entretien
          </h1>
          <p className="text-sm text-muted-foreground">
            Chiffrage rapide d&apos;après votre barème. Pour l&apos;intégrer à
            un document, ouvrez le calculateur depuis un devis ou un contrat.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/parametres/bareme-entretien">
            <Settings2 className="size-4" />
            Modifier le barème
          </Link>
        </Button>
      </div>
      <CalculateurEntretien bareme={bareme} />
    </div>
  );
}
