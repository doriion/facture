"use client";

import type { AgendaEvent } from "@/lib/actions/agenda";
import { statutFacturation } from "@/lib/agenda-facturation";
import { ymd } from "@/lib/agenda-vues";
import { Badge } from "@/components/ui/badge";

/** Titre lisible d'un évènement (sans l'heure). */
export function libelleEvenement(e: AgendaEvent): string {
  if (e.kind === "intervention") {
    const base = e.description || e.title;
    return e.client_nom ? `${base} · ${e.client_nom}` : base;
  }
  if (e.kind === "external") {
    const prefix = e.facture_emise ? "✓📱 " : "⚠︎📱 ";
    return prefix + (e.title || "(évènement)");
  }
  if (e.kind === "visite_maintenance") return e.title || "Visite maintenance";
  return e.title;
}

/**
 * Intervention posée sans client, à rattacher avant de facturer. Une
 * entrée « rien à facturer » (outils, perso…) n'a pas besoin de client.
 */
export function clientARenseigner(e: AgendaEvent): boolean {
  return e.kind === "intervention" && !e.client_id && e.a_facturer !== false;
}

/** Badge « Client à renseigner » (interventions sans client). */
export function ClientARenseignerBadge() {
  return (
    <Badge
      variant="outline"
      className="border-orange-400 font-normal text-orange-700 dark:text-orange-300"
    >
      Client à renseigner
    </Badge>
  );
}

/** Badge de statut d'un évènement (même vocabulaire que la légende). */
export function StatutEvenementBadge({ e, aujourdhui }: { e: AgendaEvent; aujourdhui?: string }) {
  const jour = aujourdhui ?? ymd(new Date());
  if (e.kind === "intervention") {
    const statut = statutFacturation(e, jour);
    return (
      <>
        {statut === "facturee" ? (
          <Badge variant="secondary" className="font-normal">Facturée</Badge>
        ) : statut === "sans_facturation" ? (
          <Badge variant="outline" className="font-normal text-muted-foreground">Rien à facturer</Badge>
        ) : statut === "prevue" ? (
          <Badge variant="outline" className="border-indigo-300 font-normal text-indigo-700 dark:text-indigo-300">
            Prévue
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-400 font-normal text-amber-700 dark:text-amber-300">
            À facturer
          </Badge>
        )}
        {clientARenseigner(e) && <ClientARenseignerBadge />}
      </>
    );
  }
  if (e.kind === "external") {
    const statut = statutFacturation(e, jour);
    return statut === "facturee" ? (
      <Badge variant="secondary" className="font-normal">RDV iPhone · facturé{e.numero ? ` (${e.numero})` : ""}</Badge>
    ) : statut === "prevue" ? (
      <Badge variant="outline" className="font-normal">RDV iPhone</Badge>
    ) : (
      <Badge variant="outline" className="border-amber-400 font-normal text-amber-700 dark:text-amber-300">
        RDV iPhone · à facturer
      </Badge>
    );
  }
  if (e.kind === "facture_prestation") {
    const libelle =
      e.statut === "retard" ? "Facture en retard" : e.statut === "annulee" ? "Facture annulée" : e.statut === "payee" ? "Facture payée" : "Facture";
    return (
      <Badge
        variant="outline"
        className={e.statut === "retard" ? "border-red-400 font-normal text-red-700 dark:text-red-300" : "font-normal"}
      >
        {libelle}
      </Badge>
    );
  }
  if (e.kind === "devis_planifie") {
    return <Badge variant="outline" className="font-normal">Devis planifié</Badge>;
  }
  return <Badge variant="outline" className="font-normal">Visite maintenance</Badge>;
}
