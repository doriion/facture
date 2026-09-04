import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getContratEntretien } from "@/lib/actions/contrats-entretien";
import { getProfil } from "@/lib/actions/profil";
import { getClient } from "@/lib/actions/clients";
import {
  prestataireEffectif,
  type ClientSnapshot,
} from "@/lib/contrats/rendu";
import { ContratApercu } from "@/components/contrats/contrat-apercu";
import { ContratEntretienActions } from "@/components/contrats/contrat-entretien-actions";
import { StatutContratBadge } from "@/components/contrats/contrats-entretien-liste";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/format";

export const metadata = { title: "Contrat d'entretien — Facture AE" };

/**
 * Fiche d'un contrat : aperçu complet (exactement le texte que verra
 * le client), actions selon le statut, et bloc de preuve une fois signé.
 */
export default async function ContratDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const contrat = await getContratEntretien(params.id);
  if (!contrat) notFound();

  const profil = await getProfil();
  const prestataire = prestataireEffectif(profil, contrat.prestataire);

  // Coordonnées client : le snapshot figé fait foi ; en brouillon, on
  // pré-visualise avec la fiche client actuelle.
  let clientSnapshot: ClientSnapshot;
  if (contrat.client_snapshot && typeof contrat.client_snapshot === "object") {
    clientSnapshot = contrat.client_snapshot as ClientSnapshot;
  } else {
    const { client } = await getClient(contrat.client_id);
    clientSnapshot = client
      ? {
          nom: client.nom,
          raison_sociale: client.raison_sociale,
          adresse: [
            client.adresse_ligne1,
            client.adresse_ligne2,
            [client.code_postal, client.ville].filter(Boolean).join(" "),
          ]
            .filter(Boolean)
            .join("\n"),
          telephone: client.telephone,
          email: client.email,
          siret: client.siret,
        }
      : {};
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/contrats">
            <ArrowLeft className="size-4" />
            Retour aux contrats
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {contrat.numero ? (
                  <span className="font-mono">Contrat {contrat.numero}</span>
                ) : (
                  "Contrat (brouillon)"
                )}
              </h1>
              <StatutContratBadge statut={contrat.statut} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {contrat.client?.nom ?? "Client inconnu"}
              {contrat.date_effet
                ? ` — effet le ${formatDateFr(contrat.date_effet)}`
                : ""}
            </p>
          </div>
          <ContratEntretienActions contrat={contrat} />
        </div>
      </div>

      {contrat.statut === "brouillon" && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Aperçu du brouillon avec vos coordonnées actuelles — elles seront
          figées à l'envoi, et le numéro attribué à ce moment-là.
        </div>
      )}

      {contrat.signed_at && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Preuve de signature électronique
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
            <p>
              Signé par :{" "}
              <span className="font-medium">
                {contrat.signataire_nom ?? "—"}
              </span>
            </p>
            <p>
              Le :{" "}
              {new Date(contrat.signed_at).toLocaleString("fr-FR", {
                timeZone: "Europe/Paris",
              })}
            </p>
            <p>Adresse IP : {contrat.signature_ip ?? "—"}</p>
            <p className="truncate" title={contrat.signature_user_agent ?? ""}>
              Navigateur : {contrat.signature_user_agent ?? "—"}
            </p>
            {contrat.pdf_sha256 && (
              <p className="break-all font-mono text-xs sm:col-span-2">
                SHA-256 du PDF : {contrat.pdf_sha256}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <ContratApercu
            contrat={contrat}
            prestataire={prestataire}
            clientSnapshot={clientSnapshot}
          />
        </CardContent>
      </Card>
    </div>
  );
}
