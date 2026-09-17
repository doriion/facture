import { Plus } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientsListe } from "@/components/clients/clients-liste";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Clients — NG Gestion" };

/**
 * Liste des clients avec recherche, filtre par type, et création inline.
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { search?: string; type?: string };
}) {
  const search = searchParams.search ?? "";
  const type = searchParams.type ?? "";

  // Liste entière : recherche et filtre sur place (ClientsListe).
  const clients = await listClients();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Clients</h1>
        </div>
        <div className="max-md:hidden">
          <ClientFormDialog />
        </div>
      </div>

      <ClientsListe clients={clients} initial={{ search, type }} />

      <MobileActionBar>
        <ClientFormDialog
          trigger={
            <Button size="lg" className="w-full">
              <Plus className="size-4" />
              Nouveau client
            </Button>
          }
        />
      </MobileActionBar>
    </div>
  );
}
