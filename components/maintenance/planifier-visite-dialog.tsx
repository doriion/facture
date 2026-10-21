"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { appelerAction } from "@/lib/appel-action";
import { planifierVisiteAction } from "@/lib/actions/visites-entretien";
import { proposerVisiteAction } from "@/lib/actions/propositions-visite";
import { formatDateFr } from "@/lib/format";
import { confirmationValable, heureChamp, heureLisible } from "@/lib/visite-entretien";
import { aujourdhuiParis } from "@/lib/dates";
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
import { DisponibilitesApercu } from "@/components/maintenance/disponibilites-apercu";

type Mode = "proposer" | "confirmer";

/**
 * « Planifier la visite », deux façons :
 * - PROPOSER au client : il reçoit ce créneau et d'autres créneaux
 *   libres de l'agenda par e-mail, choisit en ligne, et le rendez-vous
 *   s'inscrit directement dans l'agenda (confirmation envoyée) ;
 * - date FIXÉE avec le client (téléphone, sur place) : enregistrée
 *   tout de suite, confirmation par e-mail en option.
 * Sans adresse e-mail sur la fiche client, seule la seconde reste
 * possible, sans confirmation.
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
  // Une visite déjà passée ne sert pas de point de départ : aujourd'hui.
  const dateInitiale = () => (prochaineVisite && prochaineVisite >= aujourdhuiParis() ? prochaineVisite : aujourdhuiParis());
  const [date, setDate] = useState(dateInitiale);
  const [heure, setHeure] = useState(heureChamp(prochaineVisiteHeure));
  const [envoyer, setEnvoyer] = useState(Boolean(clientEmail));
  const [mode, setMode] = useState<Mode>(clientEmail ? "proposer" : "confirmer");
  const [enCours, setEnCours] = useState(false);
  const dejaConfirmee = confirmationValable({
    prochaine_visite: prochaineVisite,
    confirmation_envoyee_pour: confirmationEnvoyeePour,
  });

  function ouvrir(suivant: boolean) {
    setOpen(suivant);
    if (suivant) {
      setDate(dateInitiale());
      setHeure(heureChamp(prochaineVisiteHeure));
      setEnvoyer(Boolean(clientEmail));
      setMode(clientEmail ? "proposer" : "confirmer");
    }
  }

  async function enregistrer(ev: React.FormEvent) {
    ev.preventDefault();
    if (!date) {
      toast.error("Choisissez une date de visite.");
      return;
    }
    setEnCours(true);
    const quand = `${formatDateFr(date)}${heure ? ` à ${heureLisible(heure)}` : ""}`;
    if (mode === "proposer") {
      const prop = await appelerAction(() => proposerVisiteAction(contratId, { date, heure }));
      setEnCours(false);
      if (!prop.ok) {
        toast.error("Proposition non envoyée", { description: prop.error });
        return;
      }
      toast.success(`Proposition envoyée à ${prop.data.clientEmail}`, {
        description: `Créneau du ${quand}${prop.data.nbAutres > 0 ? ` et ${prop.data.nbAutres} autre${prop.data.nbAutres > 1 ? "s" : ""} au choix` : ""}. Le rendez-vous s'inscrira dans l'agenda dès la réponse.`,
      });
      setOpen(false);
      router.refresh();
      return;
    }
    const res = await appelerAction(() =>
      planifierVisiteAction(contratId, { date, heure, envoyerConfirmation: envoyer }),
    );
    setEnCours(false);
    if (!res.ok) {
      toast.error("Visite non planifiée", { description: res.error });
      return;
    }
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

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Comment ?</legend>
            <label className={`flex items-start gap-2 rounded-md border p-2 text-sm ${clientEmail ? "cursor-pointer" : "text-muted-foreground"} ${mode === "proposer" ? "border-primary bg-primary/5" : ""}`}>
              <input
                type="radio"
                name="mode"
                className="mt-0.5 size-4 accent-primary"
                checked={mode === "proposer"}
                disabled={!clientEmail}
                onChange={() => setMode("proposer")}
              />
              <span>
                <span className="font-medium text-foreground">Proposer au client, il choisit en ligne</span>
                <span className="block text-xs text-muted-foreground">
                  {clientEmail
                    ? "Il reçoit ce créneau et jusqu'à 6 autres créneaux libres de votre agenda par e-mail. Son choix s'inscrit directement dans l'agenda, vous êtes prévenu."
                    : "Le client n'a pas d'adresse e-mail : ajoutez-la sur sa fiche."}
                </span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm ${mode === "confirmer" ? "border-primary bg-primary/5" : ""}`}>
              <input
                type="radio"
                name="mode"
                className="mt-0.5 size-4 accent-primary"
                checked={mode === "confirmer"}
                onChange={() => setMode("confirmer")}
              />
              <span>
                <span className="font-medium text-foreground">Date déjà fixée avec le client</span>
                <span className="block text-xs text-muted-foreground">Convenue par téléphone ou sur place : enregistrée tout de suite.</span>
              </span>
            </label>
          </fieldset>

          <div className="grid grid-cols-[3fr_2fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="visite-date">{mode === "proposer" ? "Créneau proposé *" : "Date *"}</Label>
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

          {open && <DisponibilitesApercu date={date} contratId={contratId} onChoisirDate={setDate} />}

          {mode === "confirmer" && (
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
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={enCours}>
              Annuler
            </Button>
            <Button type="submit" disabled={enCours}>
              {enCours ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
              {mode === "proposer" ? "Envoyer la proposition" : envoyer && clientEmail ? "Planifier et confirmer" : "Planifier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
