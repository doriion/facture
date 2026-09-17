"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, Link2, Loader2, MapPin, Move, Navigation, Palette, Pencil, Phone, Repeat, Search, Trash2, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";

import type { AgendaEvent } from "@/lib/actions/agenda";
import { deleteInterventionAction, restaurerInterventionAction, setInterventionAFacturerAction } from "@/lib/actions/interventions";
import type { ChangementOptimiste } from "@/lib/agenda-optimiste";
import { contactEvenement, lienAppel, lienItineraire } from "@/lib/agenda-contact";
import { libelleRecurrence } from "@/lib/agenda-recurrence";
import { heureCourte, libelleJourLong } from "@/lib/agenda-vues";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  onDupliquer,
  onRegler,
  onReprendre,
  onCouleur,
  onRattacher,
  onOptimiste,
}: {
  evenement: AgendaEvent | null;
  onClose: () => void;
  style: (e: AgendaEvent) => React.CSSProperties | undefined;
  onModifier: (e: AgendaEvent) => void;
  /** Dupliquer une intervention (dialogue de planification pré-rempli). */
  onDupliquer?: (e: AgendaEvent) => void;
  /** Mode réglage sur la grille : déplacer / étirer au doigt, sans appui long. */
  onRegler?: (e: AgendaEvent) => void;
  /** RDV iPhone → intervention NG Gestion (déplaçable, modifiable, facturable). */
  onReprendre?: (e: AgendaEvent) => void;
  /** Couleur propre à cet évènement (dialogue). */
  onCouleur?: (e: AgendaEvent) => void;
  onRattacher: () => void;
  /** Mise à jour optimiste (voir QuickInterventionDialog). */
  onOptimiste?: (changement: ChangementOptimiste) => () => void;
}) {
  const router = useRouter();
  const [basculeEnCours, setBasculeEnCours] = useState(false);
  const e = evenement;
  const contact = e ? contactEvenement(e) : null;

  // « Rien à facturer » ↔ « à facturer », sans ouvrir le dialogue.
  async function basculerFacturation(ev: AgendaEvent) {
    setBasculeEnCours(true);
    const cible = ev.a_facturer === false;
    // Le tiroir se ferme et la pastille change tout de suite.
    const annuler = onOptimiste?.({ type: "facturation", id: ev.id, a_facturer: cible });
    onClose();
    const res = await setInterventionAFacturerAction(ev.id, cible);
    setBasculeEnCours(false);
    if (!res.ok) {
      annuler?.();
      toast.error("Modification refusée", { description: res.error });
      return;
    }
    toast.success(cible ? "Remise « à facturer »" : "Marquée « rien à facturer »");
    router.refresh();
  }
  const debut = heureCourte(e?.heure_debut);
  const fin = heureCourte(e?.heure_fin);

  // Supprimer CE rendez-vous = le mettre à la corbeille (pour une série,
  // « et les suivants » passe par Modifier). Le tiroir se ferme, le
  // créneau disparaît tout de suite, et « Annuler » le fait revenir.
  async function supprimer(ev: AgendaEvent) {
    const annuler = onOptimiste?.({ type: "suppression", id: ev.id });
    onClose();
    const res = await deleteInterventionAction(ev.id);
    if (!res.ok) {
      annuler?.();
      toast.error("Suppression refusée", { description: res.error });
      return;
    }
    toast.success("Mis à la corbeille", {
      duration: 8000,
      action: {
        label: "Annuler",
        onClick: async () => {
          const retour = onOptimiste?.({
            type: "creation",
            id: ev.id,
            valeurs: {
              client_id: ev.client_id,
              date_intervention: ev.date_start,
              date_fin: ev.date_end !== ev.date_start ? ev.date_end : null,
              heure_debut: ev.heure_debut,
              heure_fin: ev.heure_fin,
              type: ev.type_activite ?? "autre",
              description: ev.description,
              a_facturer: ev.a_facturer ?? true,
            },
            clientNom: ev.client_nom,
          });
          const r = await restaurerInterventionAction(ev.id);
          if (!r.ok) {
            retour?.();
            toast.error("Restauration refusée", { description: r.error });
            return;
          }
          toast.success("Rendez-vous restauré");
          router.refresh();
        },
      },
    });
    router.refresh();
  }

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
                {e.recurrence && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Repeat className="size-3.5 shrink-0" />
                    Se répète {libelleRecurrence(e.recurrence)}
                  </p>
                )}
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
              {e.kind === "external" && onReprendre && (
                <div className="col-span-2 space-y-2">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      onClose();
                      onReprendre(e);
                    }}
                  >
                    <Download className="size-4" />
                    Reprendre dans NG Gestion
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Ce rendez-vous vient du calendrier de votre téléphone, en
                    lecture seule. Repris ici, il devient un rendez-vous NG
                    Gestion : déplaçable, modifiable, facturable. Sa copie
                    téléphone disparaît de cet agenda (elle reste sur le
                    téléphone).
                  </p>
                </div>
              )}
              {e.kind === "intervention" && !e.facture_emise && onRegler && (
                <Button
                  size="lg"
                  className="col-span-2"
                  onClick={() => {
                    onClose();
                    onRegler(e);
                  }}
                >
                  <Move className="size-4" />
                  Déplacer / changer la durée
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
              {onCouleur && (
                <Button
                  size="lg"
                  variant="outline"
                  className={e.kind === "intervention" ? "" : "col-span-2"}
                  onClick={() => {
                    onClose();
                    onCouleur(e);
                  }}
                >
                  <Palette className="size-4" />
                  Couleur
                </Button>
              )}
              {e.kind === "intervention" && onDupliquer && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onDupliquer(e);
                  }}
                >
                  <Copy className="size-4" />
                  Dupliquer
                </Button>
              )}
              {e.kind === "intervention" && !e.facture_emise && (
                <Button
                  size="lg"
                  variant="outline"
                  className="col-span-2"
                  disabled={basculeEnCours}
                  onClick={() => basculerFacturation(e)}
                >
                  {basculeEnCours ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                  {e.a_facturer === false ? "Remettre « à facturer »" : "Rien à facturer"}
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
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className={
                    (e.kind === "intervention" && !e.facture_emise) ||
                    (e.kind === "external" && !e.facture_emise)
                      ? ""
                      : "col-span-2"
                  }
                >
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
              {e.kind === "intervention" && !e.facture_emise && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" variant="outline" className="text-destructive">
                      <Trash2 className="size-4" />
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Mettre ce rendez-vous à la corbeille ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {e.serie_id
                          ? "Seulement celui-ci. Pour les suivants de la série, passez par « Modifier ». Restaurable depuis la corbeille."
                          : "Il disparaît de l'agenda. Vous pourrez l'annuler tout de suite, ou le restaurer depuis la corbeille."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => supprimer(e)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
