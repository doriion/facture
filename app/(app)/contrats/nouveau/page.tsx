import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { getBaremeEntretien } from "@/lib/actions/bareme-entretien";
import { ContratEntretienForm } from "@/components/contrats/contrat-entretien-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Nouveau contrat — NG Gestion" };

export default async function NouveauContratPage({
  searchParams,
}: {
  searchParams: { client?: string };
}) {
  const [clients, baremeEntretien] = await Promise.all([
    listClients(),
    getBaremeEntretien(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/contrats">
            <ArrowLeft className="size-4" />
            Retour aux contrats
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Nouveau contrat d'entretien
        </h1>
        <p className="text-sm text-muted-foreground">
          Le contrat est créé en brouillon — vous pourrez le relire et
          l'envoyer au client depuis sa fiche.
        </p>
      </div>
      <ContratEntretienForm
        clients={clients}
        clientIdInitial={searchParams.client}
        baremeEntretien={baremeEntretien}
      />
    </div>
  );
}
