import { Plus } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { ClientsTable } from "@/components/clients/clients-table";
import { ClientsToolbar } from "@/components/clients/clients-toolbar";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Clients — Facture AE" };

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

  const clients = await listClients({ search, type });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} client{clients.length > 1 ? "s" : ""} enregistré
            {clients.length > 1 ? "s" : ""}.
          </p>
        </div>
        <div className="max-md:hidden">
          <ClientFormDialog />
        </div>
      </div>

      <ClientsToolbar initialSearch={search} initialType={type} />

      <ClientsTable clients={clients} />

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
