import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { InterventionForm } from "@/components/interventions/intervention-form";

export const metadata = { title: "Nouvelle intervention — Facture AE" };

export default async function NouvelleInterventionPage() {
  const clients = await listClients();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/interventions">
            <ArrowLeft className="size-4" />
            Retour aux interventions
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          Nouvelle intervention
        </h1>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <p className="mb-3">Aucun client. Créez-en un d'abord.</p>
          <Button asChild>
            <Link href="/clients">Aller aux clients</Link>
          </Button>
        </div>
      ) : (
        <InterventionForm clients={clients} />
      )}
    </div>
  );
}
