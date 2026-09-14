import Link from "next/link";
import { Calculator, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Accès au barème d'entretien depuis la page Paramètres. */
export function BaremeEntretienCard({ nbPostes }: { nbPostes: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Barème entretien</CardTitle>
        <CardDescription>
          Tarifs unitaires dégressifs par équipement (splits, CTA, PAC, VMC,
          VRV) et forfaits de déplacement par zone. Alimente le calculateur
          des devis et des contrats d&apos;entretien. Montants nets, sans TVA.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/parametres/bareme-entretien">
            <Settings2 className="size-4" />
            Modifier le barème ({nbPostes} postes)
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/contrats/calculateur">
            <Calculator className="size-4" />
            Ouvrir le calculateur
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
