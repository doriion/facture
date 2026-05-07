"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TYPES_CLIENT } from "@/lib/format";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { DeleteClientDialog } from "@/components/clients/delete-client-dialog";
import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];

const typeVariant: Record<string, "default" | "secondary" | "outline"> = {
  particulier: "secondary",
  professionnel: "default",
  syndic: "outline",
};

export function ClientsTable({ clients }: { clients: Client[] }) {
  if (clients.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
        Aucun client à afficher.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Ville</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="w-[120px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link
                  href={`/clients/${c.id}`}
                  className="font-medium hover:underline"
                >
                  {c.nom}
                </Link>
                {c.raison_sociale && (
                  <p className="text-xs text-muted-foreground">
                    {c.raison_sociale}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={typeVariant[c.type] ?? "default"}>
                  {TYPES_CLIENT[c.type as keyof typeof TYPES_CLIENT] ?? c.type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {c.code_postal && (
                  <span className="text-muted-foreground">{c.code_postal} </span>
                )}
                {c.ville ?? "—"}
              </TableCell>
              <TableCell className="text-sm">
                <div className="flex flex-col">
                  {c.email && <span>{c.email}</span>}
                  {c.telephone && (
                    <span className="text-muted-foreground">{c.telephone}</span>
                  )}
                  {!c.email && !c.telephone && (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <ClientFormDialog
                    client={c}
                    trigger={
                      <Button variant="ghost" size="icon">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <DeleteClientDialog clientId={c.id} clientNom={c.nom} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
