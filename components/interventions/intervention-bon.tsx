"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ExternalLink, Loader2, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteBonInterventionAction,
  genererBonInterventionAction,
  type BonIntervention,
} from "@/lib/actions/bons-intervention";
import { appelerAction } from "@/lib/appel-action";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateFr } from "@/lib/format";

function formatDateHeure(iso: string): string {
  const d = new Date(iso);
  return `${formatDateFr(iso.slice(0, 10))} à ${d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  })}`;
}

/**
 * Bon d'intervention : PDF récapitulatif (travaux, équipement, photos,
 * signatures) à remettre ou envoyer au client en fin d'intervention.
 * Chaque génération est archivée ; un bon envoyé garde la trace du
 * destinataire et ne se supprime plus.
 */
export function InterventionBon({
  interventionId,
  bons,
  clientEmail,
  clientNom,
  signatureClientPresente,
}: {
  interventionId: string;
  bons: BonIntervention[];
  clientEmail: string | null;
  clientNom: string | null;
  signatureClientPresente: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"generer" | "envoyer" | string | null>(null);
  const [envoiOpen, setEnvoiOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function generer(envoyer: boolean) {
    setPending(envoyer ? "envoyer" : "generer");
    const res = await appelerAction(() =>
      genererBonInterventionAction(interventionId, { envoyer, messagePerso: message }),
    );
    setPending(null);
    if (!res.ok) {
      toast.error(envoyer ? "Envoi impossible" : "Génération impossible", { description: res.error });
      router.refresh();
      return;
    }
    if (res.data.envoyeA) {
      toast.success("Bon d'intervention envoyé", { description: `Email envoyé à ${res.data.envoyeA}` });
      setEnvoiOpen(false);
      setMessage("");
    } else {
      toast.success("Bon d'intervention généré");
      if (res.data.url) window.open(res.data.url, "_blank", "noopener");
    }
    router.refresh();
  }

  async function supprimer(id: string) {
    setPending(id);
    const res = await appelerAction(() => deleteBonInterventionAction(id));
    setPending(null);
    if (res.ok) {
      toast.success("Bon supprimé");
      router.refresh();
    } else {
      toast.error("Suppression refusée", { description: res.error });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="size-4 text-primary" />
          Bon d&apos;intervention
        </CardTitle>
        <CardDescription>
          Récapitulatif des travaux réalisés, avec l&apos;équipement, les photos
          et les signatures, à remettre au client en fin d&apos;intervention.
          Aucun montant n&apos;y figure.
          {!signatureClientPresente && (
            <span className="block text-amber-700 dark:text-amber-400">
              Faites signer le client ci-dessus avant de générer le bon : la
              signature y figure.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => generer(false)}
            disabled={pending !== null}
            className="max-sm:w-full"
          >
            {pending === "generer" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ClipboardCheck className="size-4" />
            )}
            Générer le PDF
          </Button>
          <Button
            onClick={() => setEnvoiOpen(true)}
            disabled={pending !== null || !clientEmail}
            title={!clientEmail ? "Renseignez l'email du client sur sa fiche" : undefined}
            className="max-sm:w-full"
          >
            <Mail className="size-4" />
            Envoyer au client
          </Button>
        </div>

        {bons.length > 0 && (
          <ul className="divide-y rounded-md border">
            {bons.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">Bon généré le {formatDateHeure(b.created_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.envoye_le
                      ? `Envoyé à ${b.destinataire ?? "?"} le ${formatDateHeure(b.envoye_le)}`
                      : "Non envoyé"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {b.url && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={b.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" />
                        Ouvrir
                      </a>
                    </Button>
                  )}
                  {!b.envoye_le && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => supprimer(b.id)}
                      disabled={pending !== null}
                      aria-label="Supprimer ce bon"
                    >
                      {pending === b.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={envoiOpen} onOpenChange={setEnvoiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer le bon d&apos;intervention à {clientNom ?? "le client"}</DialogTitle>
            <DialogDescription>
              Le PDF est généré maintenant, joint à l&apos;email et archivé avec la
              trace de l&apos;envoi. Destinataire : <strong>{clientEmail}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bon_message">Message personnalisé (optionnel)</Label>
            <Textarea
              id="bon_message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Ex : Merci pour votre confiance. Pensez à purger le radiateur de la chambre dans une semaine."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnvoiOpen(false)} disabled={pending !== null}>
              Annuler
            </Button>
            <Button onClick={() => generer(true)} disabled={pending !== null}>
              {pending === "envoyer" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
