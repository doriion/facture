"use client";

import type { AgendaEvent } from "@/lib/actions/agenda";
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

/** Badge de statut d'un évènement (même vocabulaire que la légende). */
export function StatutEvenementBadge({ e }: { e: AgendaEvent }) {
  if (e.kind === "intervention") {
    return e.facture_emise ? (
      <Badge variant="secondary" className="font-normal">Facturée</Badge>
    ) : (
      <Badge variant="outline" className="border-amber-400 font-normal text-amber-700 dark:text-amber-300">
        À facturer
      </Badge>
    );
  }
  if (e.kind === "external") {
    return e.facture_emise ? (
      <Badge variant="secondary" className="font-normal">RDV iPhone · facturé{e.numero ? ` (${e.numero})` : ""}</Badge>
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
