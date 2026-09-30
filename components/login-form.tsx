"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { signInAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Mot de passe : 8 caractères minimum"),
});

type LoginValues = z.infer<typeof schema>;

/** Messages Supabase Auth traduits (les autres restaient en anglais). */
function traduireErreurConnexion(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Adresse email non confirmée : ouvrez le lien reçu par email.";
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Trop de tentatives : patientez une minute avant de réessayer.";
  }
  if (m.includes("user is banned") || m.includes("banned")) return "Compte bloqué : contactez l'administrateur.";
  if (m.includes("network") || m.includes("fetch")) return "Pas de réseau : réessayez quand la connexion revient.";
  return message;
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    try {
      // signInAction redirige côté serveur en cas de succès, donc on ne
      // récupère un retour QUE si erreur (sinon le navigateur a déjà bougé).
      const result = await signInAction(values.email, values.password, nextPath);
      if (result && !result.ok) {
        toast.error("Échec de connexion", {
          description: traduireErreurConnexion(result.error),
        });
      }
    } catch (e) {
      // Réseau coupé pendant l'envoi : sans ce garde, le bouton restait
      // figé sur son spinner.
      const message = e instanceof Error ? e.message : String(e);
      toast.error("Connexion impossible", {
        description: /fetch|network|réseau|Load failed/i.test(message)
          ? "Pas de réseau : réessayez quand la connexion revient."
          : message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>
          Saisissez vos identifiants pour accéder à votre espace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {submitting ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
