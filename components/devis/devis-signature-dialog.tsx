"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

import { signerDevisAction } from "@/lib/actions/devis-signature";
import { envoyerDevisParEmailAction } from "@/lib/actions/emails";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/interventions/signature-pad";
import { formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * « Bon pour accord » signé au doigt : réutilise le pad de signature
 * des interventions. Une fois enregistrée, la signature est IMMUABLE
 * (bucket en écriture seule + colonne verrouillée côté action) et le
 * devis passe en « accepté ».
 */
export function DevisSignatureDialog({
  devisId,
  numero,
  signatureUrl,
  dateSignature,
  statut,
  clientNom,
  clientEmail,
}: {
  devisId: string;
  numero: string;
  signatureUrl: string | null;
  dateSignature: string | null;
  statut: string;
  /** Pré-remplit le nom du signataire. */
  clientNom?: string | null;
  /** Propose d'envoyer la copie signée après enregistrement. */
  clientEmail?: string | null;
}) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [open, setOpen] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signataire, setSignataire] = useState(clientNom ?? "");

  if (signatureUrl) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-green-600/30 bg-green-500/5 px-2.5 py-1.5 text-sm">
        <CheckCircle2 className="size-4 text-green-600" />
        Signé le {dateSignature ? formatDateFr(dateSignature) : "—"}
      </span>
    );
  }
  if (statut === "refuse" || statut === "accepte") return null;

  async function onSign() {
    const blob = await padRef.current?.toBlob();
    if (!blob) {
      toast.error("Signature vide.");
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("signature", new File([blob], "bon-pour-accord.png", { type: "image/png" }));
    fd.set("signataire_nom", signataire);
    const res = await signerDevisAction(devisId, fd);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // La copie signée part au client en un geste (PDF avec la signature).
    toast.success(`Devis ${numero} accepté — signature enregistrée.`, {
      duration: clientEmail ? 12000 : 5000,
      description: clientEmail ? `Envoyer la copie signée à ${clientEmail} ?` : undefined,
      action: clientEmail
        ? {
            label: "Envoyer",
            onClick: () => {
              void envoyerDevisParEmailAction(devisId).then((r) => {
                if (r.ok) toast.success("Copie signée envoyée", { description: clientEmail });
                else toast.error("Envoi impossible", { description: r.error });
              });
            },
          }
        : undefined,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <PenLine className="size-4" />
        Faire signer le client
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bon pour accord — devis {numero}</DialogTitle>
            <DialogDescription>
              Le client signe dans le cadre ci-dessous. La signature vaut
              « Bon pour accord », est datée du jour, ne pourra plus être
              modifiée, et le devis passera en « Accepté ».
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="signataire_nom">Nom du signataire</Label>
            <Input
              id="signataire_nom"
              value={signataire}
              onChange={(e) => setSignataire(e.target.value)}
              placeholder="Prénom et nom du client"
              autoComplete="off"
            />
          </div>

          <SignaturePad padRef={padRef} onInkChange={setHasInk} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" onClick={onSign} disabled={!hasInk || saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Enregistrer la signature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
