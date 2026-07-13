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
    <>
      {/* Mobile (< md) : cartes tapables ; les actions (éditer /
          supprimer) restent de vrais boutons au-dessus du lien étiré,
          espacés pour éviter les taps accidentels. */}
      <div className="space-y-2 md:hidden">
        {clients.map((c) => (
          <div
            key={c.id}
            className="relative rounded-lg border bg-card p-4 transition-colors active:bg-accent/50"
          >
            <Link
              href={`/clients/${c.id}`}
              className="absolute inset-0"
              aria-label={`Ouvrir la fiche de ${c.nom}`}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{c.nom}</p>
                {c.raison_sociale && (
                  <p className="truncate text-xs text-muted-foreground">
                    {c.raison_sociale}
                  </p>
                )}
              </div>
              <Badge variant={typeVariant[c.type] ?? "default"}>
                {TYPES_CLIENT[c.type as keyof typeof TYPES_CLIENT] ?? c.type}
              </Badge>
            </div>
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {(c.code_postal || c.ville) && (
                <p>
                  {c.code_postal} {c.ville}
                </p>
              )}
              {c.email && <p className="truncate">{c.email}</p>}
              {c.telephone && <p>{c.telephone}</p>}
            </div>
            <div className="relative z-10 mt-3 flex items-center justify-between border-t pt-2">
              <ClientFormDialog
                client={c}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Pencil className="size-4" />
                    Modifier
                  </Button>
                }
              />
              <DeleteClientDialog clientId={c.id} clientNom={c.nom} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop (>= md) : tableau complet inchangé */}
      <div className="hidden rounded-lg border bg-card md:block">
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
    </>
  );
}
