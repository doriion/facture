import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { Button } from "@/components/ui/button";
import { InterventionForm } from "@/components/interventions/intervention-form";

export const metadata = { title: "Nouvelle intervention — NG Gestion" };

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
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Nouvelle intervention
        </h1>
      </div>

      {/* Le client est optionnel : on peut créer l'intervention sans
          client et le renseigner plus tard (obligatoire pour facturer). */}
      <InterventionForm clients={clients} />
    </div>
  );
}
