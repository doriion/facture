import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSignature, FileText, Mail, MapPin, Phone, ScrollText } from "lucide-react";

import { getClient } from "@/lib/actions/clients";
import { statutAffichageDevis } from "@/lib/validations/devis";
import { AjouterTacheButton } from "@/components/taches/ajouter-tache-button";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { DeleteClientDialog } from "@/components/clients/delete-client-dialog";
import { StatutBadge } from "@/components/factures/statut-badge";
import { StatutBadgeDevis } from "@/components/devis/statut-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateFr,
  formatEuros,
  formatSiret,
  TYPES_CLIENT,
} from "@/lib/format";

export const metadata = { title: "Détail client — Facture AE" };

/**
 * Page de détail d'un client : infos + historique factures et devis.
 */
export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { client, factures, devis } = await getClient(params.id);

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/clients">
            <ArrowLeft className="size-4" />
            Retour aux clients
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{client.nom}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">
                {TYPES_CLIENT[client.type as keyof typeof TYPES_CLIENT] ??
                  client.type}
              </Badge>
              {client.raison_sociale && (
                <span className="text-sm text-muted-foreground">
                  {client.raison_sociale}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/contrats/nouveau?client=${client.id}`}>
                <ScrollText className="size-4" />
                Créer un contrat
              </Link>
            </Button>
            <AjouterTacheButton
              lienLabel={client.nom}
              clientId={client.id}
            />
            <ClientFormDialog
              client={client}
              trigger={<Button variant="outline">Modifier</Button>}
            />
            <DeleteClientDialog
              clientId={client.id}
              clientNom={client.nom}
              trigger={<Button variant="outline">Supprimer</Button>}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(client.adresse_ligne1 || client.code_postal || client.ville) && (
              <div className="flex gap-2">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  {client.adresse_ligne1 && <p>{client.adresse_ligne1}</p>}
                  {client.adresse_ligne2 && <p>{client.adresse_ligne2}</p>}
                  {(client.code_postal || client.ville) && (
                    <p>
                      {client.code_postal} {client.ville}
                    </p>
                  )}
                  {client.pays && client.pays !== "France" && (
                    <p>{client.pays}</p>
                  )}
                </div>
              </div>
            )}
            {client.email && (
              <div className="flex gap-2">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <a
                  href={`mailto:${client.email}`}
                  className="hover:underline"
                >
                  {client.email}
                </a>
              </div>
            )}
            {client.telephone && (
              <div className="flex gap-2">
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                <a
                  href={`tel:${client.telephone}`}
                  className="hover:underline"
                >
                  {client.telephone}
                </a>
              </div>
            )}
            {client.siret && (
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">SIRET</p>
                <p className="font-mono text-sm">
                  {formatSiret(client.siret)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {client.notes ? (
              <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune note.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Factures
          </CardTitle>
          <CardDescription>
            {factures.length} facture{factures.length > 1 ? "s" : ""} enregistrée
            {factures.length > 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {factures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune facture pour ce client.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factures.map((f) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const isLate =
                    f.statut === "envoyee" &&
                    f.date_echeance &&
                    f.date_echeance < today;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/factures/${f.id}`}
                          className="hover:underline"
                        >
                          {f.numero}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDateFr(f.date_emission)}</TableCell>
                      <TableCell>
                        <StatutBadge statut={isLate ? "retard" : f.statut} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatEuros(Number(f.total_ht))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="size-5 text-primary" />
            Devis
          </CardTitle>
          <CardDescription>
            {devis.length} devis enregistré{devis.length > 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devis.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun devis pour ce client.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Validité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Total HT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devis.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/devis/${d.id}`}
                        className="hover:underline"
                      >
                        {d.numero}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDateFr(d.date_emission)}</TableCell>
                    <TableCell>{formatDateFr(d.date_validite)}</TableCell>
                    <TableCell>
                      <StatutBadgeDevis
                        statut={statutAffichageDevis(
                          d.statut,
                          d.date_validite,
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatEuros(Number(d.total_ht))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
