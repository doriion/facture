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

export type DocumentAJoindre = { id: string; numero: string; libelle: string };

/**
 * Bouton « Envoyer par email » avec dialogue de confirmation +
 * message personnalisé optionnel. Fonctionne pour facture ou devis.
 * Pour un devis, `autresDocuments` (autres devis du même client) se
 * cochent pour partir dans le MÊME e-mail : un PDF par devis.
 */
export function EmailDocumentButton({
  documentId,
  type,
  destinataireEmail,
  destinataireNom,
  variant = "default",
  disabled,
  autresDocuments = [],
}: {
  documentId: string;
  type: "facture" | "devis" | "avoir";
  destinataireEmail: string | null;
  destinataireNom: string;
  variant?: "default" | "outline";
  disabled?: boolean;
  autresDocuments?: DocumentAJoindre[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [joints, setJoints] = useState<string[]>([]);
  const joignables = type === "devis" ? autresDocuments : [];

  async function onSend() {
    if (!destinataireEmail) return;
    setSubmitting(true);
    // Un avoir est stocké comme une facture (type_facture = 'avoir') :
    // même action, PDF et email adaptés côté serveur.
    const res =
      type === "devis"
        ? await envoyerDevisParEmailAction(documentId, message, { autresDevisIds: joints })
        : await envoyerFactureParEmailAction(documentId, message);
    setSubmitting(false);
    if (res.ok) {
      const nb = type === "devis" ? 1 + joints.length : 1;
      toast.success(
        type === "facture" ? "Facture envoyée" : type === "avoir" ? "Avoir envoyé" : nb > 1 ? `${nb} devis envoyés` : "Devis envoyé",
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
        // Sans e-mail : le bouton reste actif et EXPLIQUE (un bouton grisé
        // avec une infobulle ne dit rien au doigt).
        onClick={() =>
          destinataireEmail
            ? setOpen(true)
            : toast.info("Pas d'e-mail pour ce client", {
                description: "Renseignez-le sur la fiche client, ou utilisez « Partager… ».",
              })
        }
        disabled={disabled}
        aria-disabled={!destinataireEmail || undefined}
        className={!destinataireEmail ? "opacity-70" : undefined}
      >
        <Mail className="size-4" />
        Envoyer par email
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Envoyer {type === "facture" ? "la facture" : type === "avoir" ? "l'avoir" : "le devis"} à{" "}
              {destinataireNom}
            </DialogTitle>
            <DialogDescription>
              {joints.length > 0 ? `${1 + joints.length} PDF seront joints à l'email` : "Le PDF sera joint à l'email"}. Destinataire :{" "}
              <strong>{destinataireEmail}</strong>
            </DialogDescription>
          </DialogHeader>
          {joignables.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Joindre aussi, dans le même e-mail</legend>
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {joignables.map((d) => (
                  <li key={d.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={joints.includes(d.id)}
                        onChange={(e) => setJoints((cur) => (e.target.checked ? [...cur, d.id] : cur.filter((x) => x !== d.id)))}
                      />
                      <span className="font-medium">{d.numero}</span>
                      <span className="truncate text-muted-foreground">{d.libelle}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Un PDF et un lien de signature par devis : le client peut n&apos;en retenir qu&apos;un. Chaque devis coché passe en « envoyé ».
              </p>
            </fieldset>
          )}
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
