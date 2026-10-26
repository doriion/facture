"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

import { SignaturePad, type SignaturePadHandle } from "@/components/interventions/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Page publique : le client indique son nom, coche « bon pour accord »
 * et signe au doigt. Un seul envoi ; la page par jeton affiche ensuite
 * la confirmation.
 */
export function SignatureDevisPubliqueForm({
  token,
  numero,
  clientNom,
  acompteText,
}: {
  token: string;
  numero: string;
  clientNom: string | null;
  acompteText: string | null;
}) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [nom, setNom] = useState(clientNom ?? "");
  const [accepte, setAccepte] = useState(false);
  const [aDeLEncre, setADeLEncre] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const pret = nom.trim().length >= 2 && accepte && aDeLEncre;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!pret || envoi) return;
    const blob = await padRef.current?.toBlob();
    if (!blob) {
      toast.error("Signez dans le cadre avant de valider.");
      return;
    }
    setEnvoi(true);
    try {
      const fd = new FormData();
      fd.append("signataire_nom", nom.trim());
      fd.append("accepte", accepte ? "oui" : "");
      fd.append("signature", new File([blob], "bon-pour-accord.png", { type: "image/png" }));
      const res = await fetch(`/api/public/devis/${encodeURIComponent(token)}/signer`, { method: "POST", body: fd });
      const corps = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !corps.ok) {
        toast.error(corps.error ?? "La signature n'a pas pu être enregistrée.");
        setEnvoi(false);
        if (res.status === 409 || res.status === 410) router.refresh();
        return;
      }
      router.refresh();
    } catch {
      toast.error("Erreur réseau — vérifiez votre connexion et réessayez.");
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <h2 className="text-base font-semibold">Signer le devis {numero}</h2>
      <div className="space-y-1.5">
        <Label htmlFor="sig-nom">Votre nom *</Label>
        <Input id="sig-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" className="h-12 text-base" />
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
        <span>
          J&apos;ai lu le devis {numero} et je l&apos;accepte : <strong>bon pour accord</strong>.
          {acompteText && <span className="block text-xs text-muted-foreground">Un acompte de {acompteText} est à régler à la commande, par virement (coordonnées sur le devis).</span>}
        </span>
      </label>
      <div className="space-y-1.5">
        <Label>Votre signature *</Label>
        <SignaturePad padRef={padRef} onInkChange={setADeLEncre} disabled={envoi} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!pret || envoi}>
        {envoi ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
        Signer le devis
      </Button>
      <p className="text-xs text-muted-foreground">
        La signature est datée et horodatée ; vous recevez ensuite votre exemplaire signé par e-mail.
      </p>
    </form>
  );
}
