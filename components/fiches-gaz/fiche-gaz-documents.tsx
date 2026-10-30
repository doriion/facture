"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCheck, Copy, ExternalLink, FileCheck2, Link2, Loader2, Mail, PenLine, Share2 } from "lucide-react";
import { toast } from "sonner";

import { demanderSignatureFicheAction, genererDocumentsFicheAction } from "@/lib/actions/fiches-gaz";
import type { CerfaDocument } from "@/lib/actions/cerfa";
import type { BonIntervention } from "@/lib/actions/bons-intervention";
import { appelerAction } from "@/lib/appel-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateFr } from "@/lib/format";

function dateHeure(iso: string): string {
  return `${formatDateFr(iso.slice(0, 10))} à ${new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}`;
}

/**
 * Documents de la fiche gaz : génération du CERFA 15497 et du bon de
 * réception (archivés), envoi au client (les deux PDF joints), demande
 * de signature en ligne (lien unique, e-mail ou lien à partager), et
 * archives.
 */
export function FicheGazDocuments({
  ficheId,
  clientEmail,
  clientNom,
  cerfas,
  bons,
  detenteurSigne,
  operateurSigne,
  reservesRenseignees,
  lienSignature,
  signatureDemandeeLe,
}: {
  ficheId: string;
  clientEmail: string | null;
  clientNom: string | null;
  cerfas: CerfaDocument[];
  bons: BonIntervention[];
  detenteurSigne: boolean;
  operateurSigne: boolean;
  reservesRenseignees: boolean;
  lienSignature: string | null;
  signatureDemandeeLe: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"generer" | "envoyer" | "signature" | "lien" | null>(null);
  const [envoiOpen, setEnvoiOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [lien, setLien] = useState<string | null>(lienSignature);
  const [copie, setCopie] = useState(false);

  async function generer(envoyer: boolean) {
    setPending(envoyer ? "envoyer" : "generer");
    const res = await appelerAction(() => genererDocumentsFicheAction(ficheId, { envoyer, messagePerso: message }));
    setPending(null);
    if (!res.ok) {
      toast.error(envoyer ? "Envoi impossible" : "Génération impossible", { description: res.error });
      router.refresh();
      return;
    }
    if (res.data.envoyeA) {
      toast.success("Documents envoyés", { description: `CERFA et bon de réception envoyés à ${res.data.envoyeA}` });
      setEnvoiOpen(false);
      setMessage("");
    } else {
      toast.success("CERFA et bon de réception générés", { description: "Les deux PDF sont dans les archives ci-dessous." });
      if (res.data.cerfaUrl) window.open(res.data.cerfaUrl, "_blank", "noopener");
    }
    router.refresh();
  }

  async function demanderSignature(envoyer: boolean) {
    setPending(envoyer ? "signature" : "lien");
    const res = await appelerAction(() => demanderSignatureFicheAction(ficheId, { envoyer }));
    setPending(null);
    if (!res.ok) {
      toast.error("Demande impossible", { description: res.error });
      return;
    }
    setLien(res.data.lien);
    if (res.data.envoyeA) toast.success("Invitation envoyée", { description: `${res.data.envoyeA} a reçu le lien de signature (valable jusqu'au ${formatDateFr(res.data.expireLe.slice(0, 10))}).` });
    else toast.success("Lien de signature prêt", { description: "Copiez-le ou partagez-le au client (SMS, WhatsApp…)." });
    router.refresh();
  }

  async function copier() {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error("Copie impossible — sélectionnez le lien à la main.");
    }
  }
  async function partager() {
    if (!lien) return;
    if (typeof navigator.share !== "function") return copier();
    try {
      await navigator.share({ title: "Fiche d'intervention à signer", text: `Bonjour, voici la fiche d'intervention à relire et signer : ${lien}` });
    } catch {
      // Partage annulé par l'utilisateur.
    }
  }

  const envoyerBloque = !detenteurSigne && !reservesRenseignees;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck2 className="size-4 text-primary" />
          Documents et signature du client
        </CardTitle>
        <CardDescription>
          Le CERFA 15497 et le bon de réception sont générés ensemble et archivés (à conserver 5 ans). Le client peut signer sur votre téléphone (bloc Signatures) ou en ligne depuis chez lui.
          {!operateurSigne && <span className="block text-amber-700 dark:text-amber-400">Signez d&apos;abord comme opérateur dans le bloc Signatures : votre signature figure sur les deux documents.</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => generer(false)} disabled={pending !== null}>
            {pending === "generer" ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
            Générer le CERFA + le bon (PDF)
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!clientEmail) return toast.info("Pas d'e-mail pour ce client", { description: "Renseignez-le sur la fiche client pour envoyer les documents." });
              if (envoyerBloque) return toast.info("Réserves non renseignées", { description: "Indiquez « Sans réserve » ou « Avec réserves » dans le bon de réception, ou demandez la signature en ligne : le client les indiquera lui-même." });
              setEnvoiOpen(true);
            }}
            disabled={pending !== null}
            className={!clientEmail || envoyerBloque ? "opacity-70" : undefined}
          >
            <Mail className="size-4" />
            Envoyer au client par mail
          </Button>
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div className="flex items-start gap-2">
            <PenLine className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">Signature en ligne</p>
              {detenteurSigne ? (
                <p className="text-muted-foreground">Le client a signé : CERFA et bon de réception signés sont dans les archives.</p>
              ) : signatureDemandeeLe ? (
                <p className="text-muted-foreground">Demande envoyée le {dateHeure(signatureDemandeeLe)} — en attente de la signature du client.</p>
              ) : (
                <p className="text-muted-foreground">Le client relit les documents, indique ses réserves et signe au doigt depuis son téléphone. Vous êtes prévenu aussitôt.</p>
              )}
            </div>
          </div>
          {!detenteurSigne && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => demanderSignature(true)} disabled={pending !== null || !clientEmail} title={!clientEmail ? "Le client n'a pas d'e-mail : créez le lien à partager." : undefined}>
                {pending === "signature" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                {signatureDemandeeLe ? "Renvoyer l'invitation" : "Demander la signature par mail"}
              </Button>
              <Button variant="outline" onClick={() => demanderSignature(false)} disabled={pending !== null}>
                {pending === "lien" ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                {lien ? "Renouveler le lien" : "Créer un lien à partager"}
              </Button>
            </div>
          )}
          {lien && !detenteurSigne && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{lien}</code>
              <Button type="button" variant="ghost" size="sm" onClick={copier}>
                {copie ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                Copier
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={partager}>
                <Share2 className="size-4" />
                Partager
              </Button>
            </div>
          )}
        </div>

        {(cerfas.length > 0 || bons.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Archives titre="CERFA 15497" icone={<FileCheck2 className="size-4" />} lignes={cerfas.map((c) => ({ id: c.id, url: c.url, texte: `Généré le ${dateHeure(c.created_at)}`, sous: null }))} />
            <Archives
              titre="Bon de réception"
              icone={<ClipboardCheck className="size-4" />}
              lignes={bons.map((b) => ({ id: b.id, url: b.url, texte: `Généré le ${dateHeure(b.created_at)}`, sous: b.envoye_le ? `Envoyé à ${b.destinataire ?? "?"} le ${dateHeure(b.envoye_le)}` : null }))}
            />
          </div>
        )}
      </CardContent>

      <Dialog open={envoiOpen} onOpenChange={setEnvoiOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer les documents à {clientNom ?? "le client"}</DialogTitle>
            <DialogDescription>
              Le CERFA 15497 et le bon de réception sont générés maintenant, joints au même e-mail et archivés. Destinataire : <strong>{clientEmail}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fiche_message">Message personnalisé (optionnel)</Label>
            <Textarea id="fiche_message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Ex : Merci pour votre confiance. Pensez à nettoyer les filtres tous les mois." />
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

function Archives({ titre, icone, lignes }: { titre: string; icone: React.ReactNode; lignes: Array<{ id: string; url: string; texte: string; sous: string | null }> }) {
  if (lignes.length === 0) return null;
  return (
    <div className="rounded-md border">
      <p className="flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icone}
        {titre} ({lignes.length})
      </p>
      <ul className="divide-y">
        {lignes.slice(0, 5).map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate">{l.texte}</p>
              {l.sous && <p className="truncate text-xs text-muted-foreground">{l.sous}</p>}
            </div>
            {l.url && (
              <Button variant="ghost" size="sm" asChild>
                <a href={l.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  Ouvrir
                </a>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
