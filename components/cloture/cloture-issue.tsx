"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Check, CircleSlash, Loader2, Mail, Receipt } from "lucide-react";
import { toast } from "sonner";

import { clotureSansFactureAction, facturerInterventionAction, propositionsClotureAction } from "@/lib/actions/cloture";
import type { PropositionFacturation } from "@/lib/cloture-intervention";
import { appelerAction } from "@/lib/appel-action";
import { formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Issue de l'intervention : trois grands boutons. « Facturer
 * maintenant » ouvre les propositions (devis accepté, article du
 * catalogue, barème, ligne libre) ; un tap sur une proposition prête
 * crée la facture et l'envoie si le client a un e-mail. Les deux autres
 * sortent l'intervention de la liste « à facturer ».
 */
export function ClotureIssue({
  interventionId,
  clientId,
  clientNom,
  dejaFacturee,
  aFacturer,
}: {
  interventionId: string;
  clientId: string | null;
  clientNom: string | null;
  dejaFacturee: boolean;
  aFacturer: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [props, setProps] = useState<PropositionFacturation[]>([]);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [emailConfigure, setEmailConfigure] = useState(false);
  const [envoyer, setEnvoyer] = useState(true);
  const [choisie, setChoisie] = useState(0);
  const [pending, setPending] = useState<string | null>(null);

  async function ouvrirPropositions() {
    if (!clientId) {
      toast.info("Client à renseigner", { description: "Ouvrez la fiche de l'intervention (Modifier) et choisissez le client, puis revenez facturer." });
      return;
    }
    setChargement(true);
    const res = await appelerAction(() => propositionsClotureAction(interventionId));
    setChargement(false);
    if (!res.ok) {
      toast.error("Impossible de préparer la facture", { description: res.error });
      return;
    }
    setProps(res.data.propositions);
    setClientEmail(res.data.clientEmail);
    setEmailConfigure(res.data.emailConfigure);
    setEnvoyer(Boolean(res.data.clientEmail) && res.data.emailConfigure);
    setChoisie(0);
    setOpen(true);
  }

  async function facturer() {
    const p = props[choisie];
    if (!p) return;
    if (!p.prete) {
      // Prix à saisir : on passe par le formulaire, pré-rempli.
      router.push(`/factures/nouvelle?intervention=${interventionId}`);
      return;
    }
    setPending("facturer");
    const res = await appelerAction(() => facturerInterventionAction(interventionId, { source: p.source, devisId: p.devisId, lignes: p.lignes, envoyer: envoyer && Boolean(clientEmail) }));
    setPending(null);
    if (!res.ok) {
      toast.error("Facturation impossible", { description: res.error });
      return;
    }
    setOpen(false);
    if (res.data.avertissement) toast.warning(res.data.avertissement);
    else toast.success(res.data.envoyee ? `Facture ${res.data.numero} créée et envoyée` : `Facture ${res.data.numero} créée`);
    router.push(`/factures/${res.data.factureId}`);
  }

  async function sansFacture(motif: "rien" | "donneur_ordre") {
    setPending(motif);
    const res = await appelerAction(() => clotureSansFactureAction(interventionId, motif));
    setPending(null);
    if (!res.ok) {
      toast.error("Modification refusée", { description: res.error });
      return;
    }
    toast.success(motif === "rien" ? "Intervention clôturée, rien à facturer" : "Intervention clôturée, facturée par le donneur d'ordre");
    router.push("/agenda");
  }

  if (dejaFacturee) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="size-4 text-primary" />
          Et pour la facture ?
        </CardTitle>
        <CardDescription>
          {aFacturer ? "Un tap suffit : la facture est créée depuis le devis, le catalogue ou le barème, et envoyée si le client a un e-mail." : "Cette intervention est marquée « rien à facturer ». Vous pouvez quand même la facturer."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        <Button size="lg" className="h-auto flex-col items-start gap-0.5 py-3 text-left" onClick={ouvrirPropositions} disabled={chargement || pending !== null}>
          <span className="flex items-center gap-2 text-base">
            {chargement ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
            Facturer maintenant
          </span>
          <span className="text-xs font-normal opacity-80">{clientNom ? `Facture pour ${clientNom}` : "Client à renseigner"}</span>
        </Button>
        <Button size="lg" variant="outline" className="h-auto flex-col items-start gap-0.5 py-3 text-left" onClick={() => sansFacture("donneur_ordre")} disabled={pending !== null}>
          <span className="flex items-center gap-2 text-base">
            {pending === "donneur_ordre" ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
            Facturé par le donneur d&apos;ordre
          </span>
          <span className="text-xs font-normal text-muted-foreground">Tournée, sous-traitance</span>
        </Button>
        <Button size="lg" variant="outline" className="h-auto flex-col items-start gap-0.5 py-3 text-left" onClick={() => sansFacture("rien")} disabled={pending !== null}>
          <span className="flex items-center gap-2 text-base">
            {pending === "rien" ? <Loader2 className="size-4 animate-spin" /> : <CircleSlash className="size-4" />}
            Rien à facturer
          </span>
          <span className="text-xs font-normal text-muted-foreground">Garantie, geste commercial, perso</span>
        </Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Facturer {clientNom ?? "le client"}</DialogTitle>
            <DialogDescription>Choisissez ce qui correspond : la facture est créée tout de suite avec ces lignes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {props.map((p, i) => (
              <button
                key={`${p.source}-${p.devisId ?? i}`}
                type="button"
                onClick={() => setChoisie(i)}
                className={cn("flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors", choisie === i ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/40")}
              >
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border", choisie === i ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                  {choisie === i && <Check className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{p.titre}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{p.prete ? formatEuros(p.totalHt) : "à saisir"}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">{p.detail}</span>
                  {p.lignes.length > 1 && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {p.lignes
                        .filter((l) => l.type === "ligne")
                        .slice(0, 3)
                        .map((l) => l.designation)
                        .join(" · ")}
                      {p.lignes.length > 3 ? " …" : ""}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {props[choisie]?.prete && (
            <label className={cn("flex items-center gap-2 text-sm", !clientEmail || !emailConfigure ? "text-muted-foreground" : "")}>
              <input type="checkbox" className="size-4 accent-primary" checked={envoyer && Boolean(clientEmail) && emailConfigure} disabled={!clientEmail || !emailConfigure} onChange={(e) => setEnvoyer(e.target.checked)} />
              <Mail className="size-4" />
              {clientEmail ? `Envoyer par e-mail à ${clientEmail}` : "Pas d'e-mail pour ce client : la facture restera à envoyer"}
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending !== null}>
              Annuler
            </Button>
            <Button onClick={facturer} disabled={pending !== null || props.length === 0}>
              {pending === "facturer" ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
              {props[choisie]?.prete ? (envoyer && clientEmail && emailConfigure ? "Créer et envoyer" : "Créer la facture") : "Compléter dans le formulaire"}
            </Button>
          </DialogFooter>
          {props.some((p) => p.source === "libre") && props[choisie]?.source !== "libre" && (
            <p className="text-center text-xs text-muted-foreground">
              Besoin d&apos;ajuster ?{" "}
              <Link href={`/factures/nouvelle?intervention=${interventionId}`} className="text-primary underline-offset-2 hover:underline">
                Ouvrir le formulaire complet
              </Link>
            </p>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
