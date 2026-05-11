"use client";

import { useState, useTransition } from "react";
import { Copy, RefreshCw, Loader2, Check, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { getOrCreateCalendarToken } from "@/lib/actions/profil";
import { SUPABASE_URL } from "@/lib/supabase/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function CalendarSyncCard({
  initialToken,
}: {
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  // Le flux est servi par une Edge Function Supabase (domain *.supabase.co),
  // qui contourne la Deployment Protection de Vercel — sinon iOS reçoit un
  // 401 et le calendrier reste vide.
  //
  // URL en path-style se terminant par .ics : indispensable sur iOS pour
  // que Safari déclenche le prompt « S'abonner à ce calendrier » au lieu
  // d'importer le fichier comme un évènement unique (piège avec les query
  // strings ?token=...).
  const url = token
    ? `${SUPABASE_URL}/functions/v1/calendar-ics/${token}.ics`
    : null;
  // Pour iOS, variante webcal:// — abonnement direct depuis Safari.
  const webcalUrl = url ? url.replace(/^https?:\/\//, "webcal://") : null;

  const handleGenerate = (regenerate: boolean) => {
    startTransition(async () => {
      const res = await getOrCreateCalendarToken(regenerate);
      if (res.ok) {
        setToken(res.data);
        toast.success(
          regenerate
            ? "Nouvelle URL générée — l'ancienne ne fonctionne plus."
            : "URL d'abonnement créée.",
        );
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("URL copiée");
    } catch {
      toast.error("Impossible de copier — sélectionnez et copiez manuellement.");
    }
  };

  return (
    <Card id="calendar-sync" className="scroll-mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5 text-primary" />
          Synchroniser avec votre téléphone
        </CardTitle>
        <CardDescription>
          Abonnez le calendrier de votre iPhone (ou Google Calendar) à votre
          agenda Facture AE. Toutes vos interventions, prestations facturées,
          devis planifiés et visites de maintenance s'afficheront
          automatiquement — mise à jour toutes les ~15 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!token ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aucune URL d'abonnement n'a encore été générée.
            </p>
            <Button
              onClick={() => handleGenerate(false)}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Smartphone className="size-4" />
              )}
              Générer mon URL d'abonnement
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                URL d'abonnement (à coller dans votre app calendrier)
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={url ?? ""}
                  className="font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  title="Copier"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-4 text-sm">
              <p className="font-medium">📱 Sur iPhone / iPad</p>
              <ol className="ml-4 mt-2 list-decimal space-y-1 text-muted-foreground">
                <li>
                  Ouvrez <strong>Réglages → Calendrier → Comptes → Ajouter
                  un compte → Autre</strong>.
                </li>
                <li>
                  Appuyez sur <strong>« Ajouter un calendrier avec
                  abonnement »</strong>.
                </li>
                <li>Collez l'URL ci-dessus, validez.</li>
                <li>
                  Astuce : tapez directement{" "}
                  {webcalUrl && (
                    <a
                      href={webcalUrl}
                      className="font-medium text-primary underline"
                    >
                      ce lien webcal://
                    </a>
                  )}{" "}
                  depuis Safari sur l'iPhone, iOS proposera l'abonnement
                  automatiquement.
                </li>
              </ol>

              <p className="mt-4 font-medium">📅 Google Calendar</p>
              <ol className="ml-4 mt-2 list-decimal space-y-1 text-muted-foreground">
                <li>
                  Sur le web :{" "}
                  <strong>Autres agendas → + → À partir d'une URL</strong>.
                </li>
                <li>Collez l'URL et validez.</li>
              </ol>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={pending}>
                    <RefreshCw className="size-4" />
                    Regénérer l'URL
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Regénérer l'URL d'abonnement ?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      L'URL actuelle cessera immédiatement de fonctionner.
                      Vous devrez réabonner votre téléphone avec la nouvelle
                      URL. Utile si vous pensez que l'URL a été partagée par
                      erreur.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleGenerate(true)}>
                      Regénérer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-xs text-muted-foreground self-center">
                ⚠︎ Toute personne ayant cette URL peut voir vos évènements
                (sans pouvoir les modifier).
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
