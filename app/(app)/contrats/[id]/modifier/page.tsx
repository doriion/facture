import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getContratEntretien } from "@/lib/actions/contrats-entretien";
import { listClients } from "@/lib/actions/clients";
import { ContratEntretienForm } from "@/components/contrats/contrat-entretien-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Modifier le contrat — Facture AE" };

export default async function ModifierContratPage({
  params,
}: {
  params: { id: string };
}) {
  const [contrat, clients] = await Promise.all([
    getContratEntretien(params.id),
    listClients(),
  ]);
  if (!contrat) notFound();
  // Un contrat envoyé ou signé est figé — retour à sa fiche.
  if (contrat.statut !== "brouillon") redirect(`/contrats/${contrat.id}`);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href={`/contrats/${contrat.id}`}>
            <ArrowLeft className="size-4" />
            Retour au contrat
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Modifier le brouillon
        </h1>
      </div>
      <ContratEntretienForm clients={clients} contrat={contrat} />
    </div>
  );
}
