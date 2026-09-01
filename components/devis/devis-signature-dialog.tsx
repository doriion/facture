"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

import { signerDevisAction } from "@/lib/actions/devis-signature";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/interventions/signature-pad";
import { formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
}: {
  devisId: string;
  numero: string;
  signatureUrl: string | null;
  dateSignature: string | null;
  statut: string;
}) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [open, setOpen] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);

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
    const res = await signerDevisAction(devisId, fd);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Devis ${numero} accepté — signature enregistrée.`);
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
