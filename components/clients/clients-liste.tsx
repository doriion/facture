"use client";

import { useMemo } from "react";

import { filtrerClients } from "@/lib/filtres-listes";
import { ClientsTable } from "@/components/clients/clients-table";
import { ClientsToolbar, type FiltresClientsUi } from "@/components/clients/clients-toolbar";
import { useFiltresListe } from "@/components/liste-filtree";

type Client = React.ComponentProps<typeof ClientsTable>["clients"][number];

export function ClientsListe({ clients, initial }: { clients: Client[]; initial: FiltresClientsUi }) {
  const [filtres, setFiltres] = useFiltresListe("/clients", initial);
  const filtrees = useMemo(() => filtrerClients(clients, filtres), [clients, filtres]);
  const filtreActif = Boolean(filtres.search) || (Boolean(filtres.type) && filtres.type !== "tous");

  return (
    <div className="space-y-6">
      <p className="-mt-4 text-sm text-muted-foreground">
        {filtrees.length} client{filtrees.length > 1 ? "s" : ""}
        {filtreActif ? " (filtrés)" : " enregistrés"}.
      </p>
      <ClientsToolbar filtres={filtres} onChange={setFiltres} />
      <ClientsTable clients={filtrees} />
    </div>
  );
}
