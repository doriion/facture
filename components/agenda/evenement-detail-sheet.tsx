"use client";

import Link from "next/link";
import { ExternalLink, Link2, MapPin, Navigation, Pencil, Phone, Search, UserPlus } from "lucide-react";

import type { AgendaEvent } from "@/lib/actions/agenda";
import { contactEvenement, lienAppel, lienItineraire } from "@/lib/agenda-contact";
import { heureCourte, libelleJourLong } from "@/lib/agenda-vues";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  StatutEvenementBadge,
  clientARenseigner,
  libelleEvenement,
} from "@/components/agenda/evenement-commun";

/**
 * Fiche d'un évènement (tiroir du bas sur mobile) : quand, qui, où —
 * et les actions terrain : ITINÉRAIRE (ouvre Plans / Google Maps /
 * Waze selon le téléphone), APPELER (tel:), ouvrir la fiche, modifier
 * une intervention, rattacher un RDV iPhone à une facture.
 *
 * L'adresse et le téléphone viennent du client rattaché quand il y en
 * a un ; sinon ils sont extraits du texte du RDV (lib/agenda-contact) ;
 * si l'extraction est incertaine, on propose une recherche sur le
 * libellé plutôt que rien. Sans rien : les boutons n'apparaissent pas.
 */
export function EvenementDetailSheet({
  evenement,
  onClose,
  style,
  onModifier,
  onRattacher,
}: {
  evenement: AgendaEvent | null;
  onClose: () => void;
  style: (e: AgendaEvent) => React.CSSProperties | undefined;
  onModifier: (e: AgendaEvent) => void;
  onRattacher: () => void;
}) {
  const e = evenement;
  const contact = e ? contactEvenement(e) : null;
  const debut = heureCourte(e?.heure_debut);
  const fin = heureCourte(e?.heure_fin);

  return (
    <Sheet open={!!e} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-lg p-0 sm:rounded-2xl">
        {e && contact && (
          <div className="space-y-4 p-4 pb-6">
            <div className="flex items-start gap-3 pr-8">
              <span
                className="mt-1 h-10 w-1.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/20"
                style={style(e)}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold leading-snug">
                  {libelleEvenement(e)}
                </SheetTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {libelleJourLong(e.date_start)}
                  {e.date_end !== e.date_start && ` → ${libelleJourLong(e.date_end)}`}
                  {debut && ` · ${debut}${fin ? `–${fin}` : ""}`}
                </p>
                <div className="mt-1.5">
                  <StatutEvenementBadge e={e} />
                </div>
              </div>
            </div>

            {/* Intervention sans client : on le dit clairement et on
                propose de l'ajouter (même dialogue que « Modifier »). */}
            {clientARenseigner(e) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-100">
                <span>
                  Aucun client rattaché — à renseigner avant de facturer.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-orange-400 bg-background"
                  onClick={() => {
                    onClose();
                    onModifier(e);
                  }}
                >
                  <UserPlus className="size-4" />
                  Ajouter un client
                </Button>
              </div>
            )}

            {(contact.adresse || contact.telephone || contact.rechercheLibelle) && (
              <dl className="space-y-1 text-sm">
                {contact.adresse && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <dd className="min-w-0 break-words">
                      {contact.adresse}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {contact.adresseSource === "client"
                          ? "(fiche client)"
                          : contact.adresseSource === "lieu"
                            ? "(lieu du RDV)"
                            : "(extraite du libellé)"}
                      </span>
                    </dd>
                  </div>
                )}
                {contact.telephone && (
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <dd>
                      {contact.telephone}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {contact.telephoneSource === "client" ? "(fiche client)" : "(extrait du libellé)"}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {e.description && e.kind === "external" && (
              <p className="whitespace-pre-line rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {e.description}
              </p>
            )}

            {/* Actions terrain : zones tapables ≥ 44 px */}
            <div className="grid grid-cols-2 gap-2">
              {contact.adresse && (
                <Button asChild size="lg" className="col-span-2">
                  <a href={lienItineraire(contact.adresse)} target="_blank" rel="noopener">
                    <Navigation className="size-4" />
                    Itinéraire
                  </a>
                </Button>
              )}
              {!contact.adresse && contact.rechercheLibelle && (
                <Button asChild size="lg" variant="outline" className="col-span-2">
                  <a href={lienItineraire(contact.rechercheLibelle)} target="_blank" rel="noopener">
                    <Search className="size-4" />
                    Chercher « {contact.rechercheLibelle} » sur la carte
                  </a>
                </Button>
              )}
              {contact.telephone && (
                <Button asChild size="lg" variant={contact.adresse ? "outline" : "default"} className="col-span-2">
                  <a href={lienAppel(contact.telephone)}>
                    <Phone className="size-4" />
                    Appeler {contact.telephone}
                  </a>
                </Button>
              )}
              {e.kind === "intervention" && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onModifier(e);
                  }}
                >
                  <Pencil className="size-4" />
                  Modifier
                </Button>
              )}
              {e.kind === "external" && !e.facture_emise && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onRattacher();
                  }}
                >
                  <Link2 className="size-4" />
                  Rattacher à une facture
                </Button>
              )}
              {e.href !== "#" && (
                <Button asChild size="lg" variant="outline" className={e.kind === "intervention" || (e.kind === "external" && !e.facture_emise) ? "" : "col-span-2"}>
                  <Link href={e.href}>
                    <ExternalLink className="size-4" />
                    {e.kind === "facture_prestation" || (e.kind === "external" && e.facture_emise)
                      ? "Ouvrir la facture"
                      : e.kind === "devis_planifie"
                        ? "Ouvrir le devis"
                        : "Ouvrir la fiche"}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
