import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { detecteursConnus } from "@/lib/actions/fiches-gaz";
import { aujourdhuiParis } from "@/lib/dates";
import { FicheGazForm } from "@/components/fiches-gaz/fiche-gaz-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Nouvelle fiche gaz — NG Gestion" };

export default async function NouvelleFicheGazPage(props: { searchParams: Promise<{ client?: string; date?: string }> }) {
  const searchParams = await props.searchParams;
  const [clients, detecteurs] = await Promise.all([listClients(), detecteursConnus()]);
  // ?client= (depuis la fiche client ou « un équipement de plus ») :
  // pré-sélectionné s'il existe ; ?date= reprise si valide.
  const clientIdParDefaut = clients.some((c) => c.id === searchParams.client) ? searchParams.client : undefined;
  const dateParDefaut = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : aujourdhuiParis();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/fiches-gaz">
            <ArrowLeft className="size-4" />
            Retour aux fiches gaz
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Nouvelle fiche gaz</h1>
        <p className="mt-1 text-sm text-muted-foreground">Le n° de fiche est attribué à la création ; photos, signatures et documents viennent ensuite.</p>
      </div>
      <FicheGazForm clients={clients} fiche={null} dateParDefaut={dateParDefaut} clientIdParDefaut={clientIdParDefaut} detecteurs={detecteurs} />
    </div>
  );
}
