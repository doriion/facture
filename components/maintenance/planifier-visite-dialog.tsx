"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { appelerAction } from "@/lib/appel-action";
import { planifierVisiteAction } from "@/lib/actions/visites-entretien";
import { formatDateFr } from "@/lib/format";
import { confirmationValable, heureChamp, heureLisible } from "@/lib/visite-entretien";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * « Planifier la visite » : la date (et l'heure) convenues avec le
 * client, et l'envoi de la confirmation par e-mail en même temps.
 * Sans adresse e-mail sur la fiche client, la date s'enregistre quand
 * même, la confirmation est simplement proposée grisée.
 */
export function PlanifierVisiteDialog({
  contratId,
  clientNom,
  clientEmail,
  prochaineVisite,
  prochaineVisiteHeure,
  confirmationEnvoyeePour,
  trigger,
}: {
  contratId: string;
  clientNom: string | null;
  clientEmail: string | null;
  prochaineVisite: string | null;
  prochaineVisiteHeure: string | null;
  confirmationEnvoyeePour: string | null;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(prochaineVisite ?? "");
  const [heure, setHeure] = useState(heureChamp(prochaineVisiteHeure));
  const [envoyer, setEnvoyer] = useState(Boolean(clientEmail));
  const [enCours, setEnCours] = useState(false);
  const dejaConfirmee = confirmationValable({
    prochaine_visite: prochaineVisite,
    confirmation_envoyee_pour: confirmationEnvoyeePour,
  });

  function ouvrir(suivant: boolean) {
    setOpen(suivant);
    if (suivant) {
      setDate(prochaineVisite ?? "");
      setHeure(heureChamp(prochaineVisiteHeure));
      setEnvoyer(Boolean(clientEmail));
    }
  }

  async function enregistrer(ev: React.FormEvent) {
    ev.preventDefault();
    if (!date) {
      toast.error("Choisissez une date de visite.");
      return;
    }
    setEnCours(true);
    const res = await appelerAction(() =>
      planifierVisiteAction(contratId, { date, heure, envoyerConfirmation: envoyer }),
    );
    setEnCours(false);
    if (!res.ok) {
      toast.error("Visite non planifiée", { description: res.error });
      return;
    }
    const quand = `${formatDateFr(date)}${heure ? ` à ${heureLisible(heure)}` : ""}`;
    if (res.data.confirmationEnvoyee) {
      toast.success(`Visite planifiée le ${quand}`, {
        description: `Confirmation envoyée à ${clientEmail}.`,
      });
    } else if (res.data.motif) {
      toast.warning(`Visite planifiée le ${quand}`, { description: res.data.motif });
    } else {
      toast.success(`Visite planifiée le ${quand}`);
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={ouvrir}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={enregistrer} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Planifier la visite d&apos;entretien</DialogTitle>
            <DialogDescription>
              Date convenue{clientNom ? ` avec ${clientNom}` : " avec le client"}.
              {prochaineVisite && (
                <>
                  {" "}Actuellement prévue le {formatDateFr(prochaineVisite)}
                  {prochaineVisiteHeure ? ` à ${heureLisible(prochaineVisiteHeure)}` : ""}
                  {dejaConfirmee ? ", confirmation déjà envoyée" : ""}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-[3fr_2fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="visite-date">Date *</Label>
              <Input
                id="visite-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visite-heure">Heure (optionnel)</Label>
              <Input
                id="visite-heure"
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
              />
            </div>
          </div>

          <label className={`flex items-start gap-2 text-sm ${clientEmail ? "cursor-pointer" : "text-muted-foreground"}`}>
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={envoyer}
              disabled={!clientEmail}
              onChange={(e) => setEnvoyer(e.target.checked)}
            />
            <span>
              {clientEmail ? (
                <>
                  Envoyer la confirmation par e-mail à{" "}
                  <span className="font-medium text-foreground">{clientEmail}</span>
                  <span className="block text-xs text-muted-foreground">
                    Date, heure et adresse de l&apos;installation ; le client répond au message pour changer de créneau.
                  </span>
                </>
              ) : (
                <>
                  Le client n&apos;a pas d&apos;adresse e-mail : ajoutez-la sur sa fiche pour envoyer la confirmation.
                </>
              )}
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={enCours}>
              Annuler
            </Button>
            <Button type="submit" disabled={enCours}>
              {enCours ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
              {envoyer && clientEmail ? "Planifier et confirmer" : "Planifier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
