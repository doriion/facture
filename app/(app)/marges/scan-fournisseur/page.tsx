import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ciblesCoutsAction } from "@/lib/actions/factures-fournisseur";
import { ScanFournisseur } from "@/components/marges/scan-fournisseur";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Scanner une facture fournisseur — NG Gestion" };

/**
 * Photo du ticket ou de la facture du grossiste → lignes et prix lus sur
 * le téléphone → prix d'achat renseignés sur le devis, la facture ou le
 * catalogue. Page INTERNE : les prix d'achat ne figurent sur aucun
 * document client.
 */
export default async function ScanFournisseurPage() {
  const res = await ciblesCoutsAction();
  const cibles = res.ok ? res.data : { documents: [], articles: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/marges">
            <ArrowLeft className="size-4" />
            Retour aux marges
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Scanner une facture fournisseur</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Photographiez le ticket du grossiste : l&apos;app lit les lignes et les prix, vous les rattachez au devis, à la facture ou au catalogue, et vos marges sont justes sans ressaisie.
        </p>
      </div>
      <ScanFournisseur cibles={cibles} />
    </div>
  );
}
