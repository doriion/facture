import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { getIntervention } from "@/lib/actions/interventions";
import { formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  InterventionForm,
  type InterventionPrefill,
} from "@/components/interventions/intervention-form";

export const metadata = { title: "Nouvelle intervention — NG Gestion" };

export default async function NouvelleInterventionPage({
  searchParams,
}: {
  searchParams: { client?: string; source?: string };
}) {
  // ?source= (« planifier la prochaine visite ») : on repart d'une
  // intervention passée — même client, même matériel, même fluide. Les
  // quantités, heures, notes et la facture ne sont PAS reprises.
  const source =
    searchParams.source && /^[0-9a-f-]{36}$/i.test(searchParams.source)
      ? (await getIntervention(searchParams.source)).intervention
      : null;
  const clients = await listClients();
  // ?client= (depuis la fiche client) : pré-sélectionné s'il existe.
  const clientDemande = searchParams.client ?? source?.client_id ?? undefined;
  const clientParDefaut = clients.some((c) => c.id === clientDemande)
    ? clientDemande
    : undefined;
  const prefill: InterventionPrefill | undefined = source
    ? {
        type: source.type,
        description: source.description,
        equipement_marque: source.equipement_marque,
        equipement_modele: source.equipement_modele,
        equipement_num_serie: source.equipement_num_serie,
        fluide_frigo_type: source.fluide_frigo_type,
        fluide_charge_totale_kg: source.fluide_charge_totale_kg,
      }
    : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/interventions">
            <ArrowLeft className="size-4" />
            Retour aux interventions
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Nouvelle intervention
        </h1>
        {source && (
          <p className="mt-1 text-sm text-muted-foreground">
            Prochaine visite d&apos;après l&apos;
            <Link href={`/interventions/${source.id}`} className="underline">
              intervention du {formatDateFr(source.date_intervention)}
            </Link>
            {" "}: client, matériel et fluide repris, à vous de poser la date.
          </p>
        )}
      </div>

      {/* Le client est optionnel : on peut créer l'intervention sans
          client et le renseigner plus tard (obligatoire pour facturer). */}
      <InterventionForm
        clients={clients}
        clientIdParDefaut={clientParDefaut}
        prefill={prefill}
      />
    </div>
  );
}
