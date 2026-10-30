"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

import { SignaturePad, type SignaturePadHandle } from "@/components/interventions/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Page publique : le client indique son nom (et sa qualité), choisit
 * « sans réserve » ou décrit ses réserves, et signe au doigt. Un seul
 * envoi ; la page par jeton affiche ensuite la confirmation.
 */
export function SignatureFichePubliqueForm({ token, clientNom, reservesInitiales }: { token: string; clientNom: string | null; reservesInitiales: string }) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [nom, setNom] = useState(clientNom ?? "");
  const [qualite, setQualite] = useState("");
  const [reserves, setReserves] = useState<"sans" | "avec" | null>(reservesInitiales ? "avec" : null);
  const [reservesTexte, setReservesTexte] = useState(reservesInitiales);
  const [aDeLEncre, setADeLEncre] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const pret = nom.trim().length >= 2 && reserves !== null && (reserves === "sans" || reservesTexte.trim().length > 0) && aDeLEncre;

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
      fd.append("signataire_qualite", qualite.trim());
      fd.append("bon_reserves", reserves ?? "");
      fd.append("bon_reserves_texte", reserves === "avec" ? reservesTexte.trim() : "");
      fd.append("signature", new File([blob], "signature.png", { type: "image/png" }));
      const res = await fetch(`/api/public/fiches/${encodeURIComponent(token)}/signer`, { method: "POST", body: fd });
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

  const choix = (valeur: "sans" | "avec", libelle: string, aide: string) => (
    <button
      type="button"
      onClick={() => setReserves(valeur)}
      aria-pressed={reserves === valeur}
      className={`flex-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${reserves === valeur ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}
    >
      <span className="block font-medium">{libelle}</span>
      <span className="block text-xs text-muted-foreground">{aide}</span>
    </button>
  );

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <h2 className="text-base font-semibold">Réception des travaux et signature</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sig-nom">Votre nom *</Label>
          <Input id="sig-nom" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" className="h-12 text-base" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sig-qualite">Votre qualité</Label>
          <Input id="sig-qualite" value={qualite} onChange={(e) => setQualite(e.target.value)} placeholder="Propriétaire, locataire, gérant…" className="h-12 text-base" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Réception des travaux *</Label>
        <div className="flex gap-2">
          {choix("sans", "Sans réserve", "L'installation fonctionne, rien à signaler.")}
          {choix("avec", "Avec réserves", "Un point reste à reprendre.")}
        </div>
      </div>
      {reserves === "avec" && (
        <div className="space-y-1.5">
          <Label htmlFor="sig-reserves">Vos réserves *</Label>
          <Textarea id="sig-reserves" value={reservesTexte} onChange={(e) => setReservesTexte(e.target.value)} rows={3} placeholder="Ex : grille de l'unité extérieure à refixer, bruit au démarrage…" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Votre signature *</Label>
        <SignaturePad padRef={padRef} onInkChange={setADeLEncre} disabled={envoi} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={!pret || envoi}>
        {envoi ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />}
        Signer la fiche et le bon de réception
      </Button>
      <p className="text-xs text-muted-foreground">
        Votre signature, datée et horodatée, est reportée sur la fiche CERFA 15497 et sur le bon de réception ; vous recevez ensuite vos exemplaires signés par e-mail.
      </p>
    </form>
  );
}
