"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { signOutAction } from "@/lib/actions/auth";
import { verifierCodeConnexionAction } from "@/lib/actions/mfa";
import { normaliserCodeTotp } from "@/lib/mfa-helpers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Deuxième étape de connexion : code à 6 chiffres de l'application. */
export function MfaVerificationForm({ nextPath }: { nextPath?: string }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normaliserCodeTotp(code)) {
      toast.error("Le code fait 6 chiffres.");
      return;
    }
    setSubmitting(true);
    // Redirige côté serveur en cas de succès : un retour = une erreur.
    const result = await verifierCodeConnexionAction(code, nextPath);
    setSubmitting(false);
    if (result && !result.ok) {
      toast.error("Vérification refusée", { description: result.error });
      setCode("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          Double authentification
        </CardTitle>
        <CardDescription>
          Saisissez le code à 6 chiffres affiché par votre application
          d&apos;authentification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              placeholder="123 456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-12 text-center font-mono text-2xl tracking-[0.3em]"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {submitting ? "Vérification…" : "Valider"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Téléphone perdu ? Le facteur se retire depuis le tableau de bord
            Supabase (Authentication → Users → votre compte).
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => signOutAction()}
          >
            Se déconnecter
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
