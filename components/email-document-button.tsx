"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import {
  envoyerFactureParEmailAction,
  envoyerDevisParEmailAction,
} from "@/lib/actions/emails";
import { Button } from "@/components/ui/button";
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

/**
 * Bouton « Envoyer par email » avec dialogue de confirmation +
 * message personnalisé optionnel. Fonctionne pour facture ou devis.
 */
export function EmailDocumentButton({
  documentId,
  type,
  destinataireEmail,
  destinataireNom,
  variant = "default",
  disabled,
}: {
  documentId: string;
  type: "facture" | "devis";
  destinataireEmail: string | null;
  destinataireNom: string;
  variant?: "default" | "outline";
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function onSend() {
    if (!destinataireEmail) return;
    setSubmitting(true);
    const action =
      type === "facture"
        ? envoyerFactureParEmailAction
        : envoyerDevisParEmailAction;
    const res = await action(documentId, message);
    setSubmitting(false);
    if (res.ok) {
      toast.success(
        type === "facture" ? "Facture envoyée" : "Devis envoyé",
        { description: `Email envoyé à ${destinataireEmail}` },
      );
      setOpen(false);
      router.refresh();
    } else {
      toast.error("Échec de l'envoi", { description: res.error });
    }
  }

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setOpen(true)}
        disabled={disabled || !destinataireEmail}
        title={
          !destinataireEmail ? "Renseignez l'email du client" : undefined
        }
      >
        <Mail className="size-4" />
        Envoyer par email
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Envoyer {type === "facture" ? "la facture" : "le devis"} à{" "}
              {destinataireNom}
            </DialogTitle>
            <DialogDescription>
              Le PDF sera joint à l'email. Destinataire :{" "}
              <strong>{destinataireEmail}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="email_message">
              Message personnalisé (optionnel)
            </Label>
            <Textarea
              id="email_message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Ex : Bonjour, voici la facture pour les travaux de la semaine dernière. Bon week-end !"
            />
            <p className="text-xs text-muted-foreground">
              Ajouté entre l'intro standard et la signature.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button onClick={onSend} disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
