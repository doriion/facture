"use client";

import { useState } from "react";
import { Loader2, Mail, MapPin, Phone, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { appelerAction } from "@/lib/appel-action";
import { enregistrerClientDetecteAction, type ClientEnregistreDepuisAgenda } from "@/lib/actions/clients-agenda";
import { adresseDetectee, type ClientDetecte } from "@/lib/client-depuis-evenement";
import { Button } from "@/components/ui/button";

/**
 * « Client détecté » : les coordonnées lues dans le rendez-vous (nom,
 * téléphone, e-mail, adresse) et un seul bouton pour en faire une fiche
 * client — rattachée au rendez-vous quand c'est une intervention.
 */
export function ClientDetecteCard({
  detecte,
  interventionId = null,
  onEnregistre,
  compact = false,
}: {
  detecte: ClientDetecte;
  /** Intervention sans client à laquelle rattacher la fiche créée. */
  interventionId?: string | null;
  onEnregistre?: (resultat: ClientEnregistreDepuisAgenda) => void;
  /** Dans un formulaire : présentation resserrée. */
  compact?: boolean;
}) {
  const [enCours, setEnCours] = useState(false);
  const adresse = adresseDetectee(detecte);

  async function enregistrer() {
    setEnCours(true);
    const res = await appelerAction(() => enregistrerClientDetecteAction(detecte, interventionId));
    setEnCours(false);
    if (!res.ok) {
      toast.error("Client non enregistré", { description: res.error });
      return;
    }
    const { data } = res;
    toast.success(
      data.existant ? `${data.nom} : fiche déjà existante` : `${data.nom} enregistré dans vos clients`,
      {
        description: data.rattache
          ? "Rattaché à ce rendez-vous."
          : data.existant
            ? "Aucune nouvelle fiche créée, l'existante a été reprise."
            : undefined,
        action: { label: "Voir la fiche", onClick: () => window.location.assign(`/clients/${data.id}`) },
      },
    );
    onEnregistre?.(data);
  }

  return (
    <div
      className={`rounded-md border border-primary/30 bg-primary/5 text-sm ${compact ? "px-3 py-2" : "p-3"}`}
      data-testid="client-detecte"
    >
      <p className="font-medium">
        Client détecté dans le rendez-vous : <span className="font-semibold">{detecte.nom}</span>
      </p>
      <ul className="mt-1 space-y-0.5 text-muted-foreground">
        {detecte.telephone && (
          <li className="flex items-center gap-2">
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{detecte.telephone}</span>
          </li>
        )}
        {detecte.email && (
          <li className="flex items-center gap-2">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="break-all">{detecte.email}</span>
          </li>
        )}
        {adresse && (
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="break-words">{adresse}</span>
          </li>
        )}
      </ul>
      <Button
        type="button"
        size={compact ? "sm" : "lg"}
        className={compact ? "mt-2" : "mt-3 w-full"}
        disabled={enCours}
        onClick={enregistrer}
      >
        {enCours ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        Enregistrer ce client
      </Button>
    </div>
  );
}
