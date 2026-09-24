"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import {
  confirmerEnrolementAction,
  demarrerEnrolementAction,
  desactiverMfaAction,
  type EtatMfa,
} from "@/lib/actions/mfa";
import { appelerAction } from "@/lib/appel-action";
import { normaliserCodeTotp } from "@/lib/mfa-helpers";
import { formatDateFr } from "@/lib/format";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Enrolement = { factorId: string; qrCodeSvg: string; secret: string; uri: string };

/**
 * Double authentification par application (TOTP). Activée : chaque
 * connexion demande le mot de passe PUIS un code à 6 chiffres. Portée
 * par Supabase Auth, rien dans les tables de l'application.
 */
export function DoubleAuthentificationCard({ etat }: { etat: EtatMfa }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [enrolement, setEnrolement] = useState<Enrolement | null>(null);
  const [code, setCode] = useState("");
  const [desactiverOpen, setDesactiverOpen] = useState(false);
  const [codeDesactivation, setCodeDesactivation] = useState("");

  async function demarrer() {
    setPending(true);
    const res = await appelerAction(() => demarrerEnrolementAction());
    setPending(false);
    if (!res.ok) {
      toast.error("Activation impossible", { description: res.error });
      return;
    }
    setEnrolement(res.data);
    setCode("");
  }

  async function confirmer() {
    if (!enrolement) return;
    if (!normaliserCodeTotp(code)) {
      toast.error("Le code fait 6 chiffres.");
      return;
    }
    setPending(true);
    const res = await appelerAction(() => confirmerEnrolementAction(enrolement.factorId, code));
    setPending(false);
    if (!res.ok) {
      toast.error("Code refusé", { description: res.error });
      return;
    }
    toast.success("Double authentification activée", {
      description: "À chaque connexion, le code de l'application sera demandé après le mot de passe.",
    });
    setEnrolement(null);
    router.refresh();
  }

  async function desactiver() {
    setPending(true);
    const res = await appelerAction(() => desactiverMfaAction(codeDesactivation));
    setPending(false);
    if (!res.ok) {
      toast.error("Désactivation refusée", { description: res.error });
      return;
    }
    toast.success("Double authentification désactivée");
    setDesactiverOpen(false);
    setCodeDesactivation("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {etat.actif ? (
            <ShieldCheck className="size-5 text-emerald-600" />
          ) : (
            <ShieldOff className="size-5 text-muted-foreground" />
          )}
          Double authentification
        </CardTitle>
        <CardDescription>
          Un code à 6 chiffres, généré par une application (Google
          Authenticator, Authy, 1Password…), est demandé après le mot de passe.
          Vos factures, clients et coûts d&apos;achat ne sont plus accessibles
          avec le seul mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {etat.actif ? (
          <>
            <p className="text-sm">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">Activée</span>{" "}
              depuis le {formatDateFr(etat.actif.depuis.slice(0, 10))}.
            </p>
            <p className="text-xs text-muted-foreground">
              Téléphone perdu ? Le facteur se retire depuis le tableau de bord
              Supabase (Authentication → Users → votre compte → Factors).
              Gardez-y un accès.
            </p>
            <Button variant="outline" onClick={() => setDesactiverOpen(true)} disabled={pending}>
              <ShieldOff className="size-4" />
              Désactiver
            </Button>
          </>
        ) : enrolement ? (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Ouvrez votre application d&apos;authentification.</li>
              <li>Scannez ce QR code, ou saisissez la clé manuellement.</li>
              <li>Entrez le code affiché pour confirmer.</li>
            </ol>
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <div
                className="size-44 shrink-0 rounded-md border bg-white p-2 [&>svg]:size-full"
                // SVG produit par Supabase Auth pour ce compte (pas une saisie).
                dangerouslySetInnerHTML={{ __html: enrolement.qrCodeSvg }}
                aria-label="QR code à scanner"
                role="img"
              />
              <div className="min-w-0 space-y-2 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Clé manuelle</p>
                <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                  {enrolement.secret}
                </code>
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="mfa-code">Code affiché par l&apos;application</Label>
                  <Input
                    id="mfa-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={7}
                    placeholder="123 456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-11 font-mono text-lg tracking-widest sm:w-48"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={confirmer} disabled={pending || !normaliserCodeTotp(code)}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Confirmer et activer
              </Button>
              <Button variant="ghost" onClick={() => setEnrolement(null)} disabled={pending}>
                Annuler
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Rien n&apos;est activé tant que le premier code n&apos;est pas confirmé.
            </p>
          </div>
        ) : (
          <Button onClick={demarrer} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Activer
          </Button>
        )}
      </CardContent>

      <Dialog open={desactiverOpen} onOpenChange={setDesactiverOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Désactiver la double authentification ?</DialogTitle>
            <DialogDescription>
              Le mot de passe seul suffira de nouveau. Confirmez avec le code
              actuel de votre application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="mfa-code-off">Code</Label>
            <Input
              id="mfa-code-off"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123 456"
              value={codeDesactivation}
              onChange={(e) => setCodeDesactivation(e.target.value)}
              className="h-11 font-mono text-lg tracking-widest"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDesactiverOpen(false)} disabled={pending}>
              Retour
            </Button>
            <Button
              variant="destructive"
              onClick={desactiver}
              disabled={pending || !normaliserCodeTotp(codeDesactivation)}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
              Désactiver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
