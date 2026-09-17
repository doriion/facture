import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";

import { getBaremeEntretien } from "@/lib/actions/bareme-entretien";
import { BaremeEntretienEditor } from "@/components/parametres/bareme-entretien-editor";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Barème entretien — NG Gestion" };

export default async function BaremeEntretienPage() {
  const bareme = await getBaremeEntretien();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
            <Link href="/parametres">
              <ArrowLeft className="size-4" />
              Retour aux paramètres
            </Link>
          </Button>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Barème entretien
          </h1>
          <p className="text-sm text-muted-foreground">
            Vos tarifs d&apos;entretien, utilisés par le calculateur dans les
            devis et les contrats. Montants nets : aucune TVA n&apos;est
            appliquée (franchise en base).
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/contrats/calculateur">
            <Calculator className="size-4" />
            Ouvrir le calculateur
          </Link>
        </Button>
      </div>
      <BaremeEntretienEditor bareme={bareme} />
    </div>
  );
}
