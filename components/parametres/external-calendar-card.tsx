"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, Save, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { saveExternalCalendarUrlAction } from "@/lib/actions/profil";
import { reprendreTousLesRdvIphoneAction } from "@/lib/actions/reprise-externe";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ExternalCalendarCard({
  initialUrl,
}: {
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [pending, startTransition] = useTransition();
  const [reprise, setReprise] = useState(false);

  async function toutReprendre() {
    setReprise(true);
    const res = await reprendreTousLesRdvIphoneAction();
    setReprise(false);
    if (!res.ok) {
      toast.error("Reprise impossible", { description: res.error });
      return;
    }
    toast.success(
      res.data.repris === 0
        ? "Rien à reprendre : tous les RDV à venir sont déjà dans NG Gestion."
        : `${res.data.repris} RDV repris dans NG Gestion.`,
      res.data.erreurs > 0 ? { description: `${res.data.erreurs} en erreur.` } : undefined,
    );
  }

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveExternalCalendarUrlAction(url || null);
      if (res.ok) {
        toast.success(
          url
            ? "Calendrier externe enregistré. Les évènements apparaîtront dans l'agenda."
            : "Calendrier externe retiré.",
        );
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  };

  const handleClear = () => {
    setUrl("");
    startTransition(async () => {
      const res = await saveExternalCalendarUrlAction(null);
      if (res.ok) {
        toast.success("Calendrier externe retiré.");
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-5 text-primary" />
          Importer mon calendrier téléphone
        </CardTitle>
        <CardDescription>
          Affiche dans votre agenda les évènements que vous notez sur
          l'app Calendrier de votre iPhone (ou Google Calendar). En lecture
          seule, rafraîchi automatiquement toutes les ~5 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="external_url">
            URL publique du calendrier (webcal:// ou https://)
          </Label>
          <Input
            id="external_url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="webcal://p15-caldav.icloud.com/published/..."
            className="font-mono text-xs"
          />
        </div>

        <div className="rounded-md border bg-muted/30 p-4 text-sm">
          <p className="font-medium">📱 Comment publier un calendrier iPhone</p>
          <ol className="ml-4 mt-2 list-decimal space-y-1 text-muted-foreground">
            <li>
              Ouvrez l'app <strong>Calendrier</strong> → appuyez sur{" "}
              <strong>« Calendriers »</strong> en bas.
            </li>
            <li>
              Appuyez sur le <strong>i (info)</strong> à côté du calendrier que
              vous voulez partager (ex. « Travail », « Pro »).
            </li>
            <li>
              Activez <strong>« Calendrier public »</strong>.
            </li>
            <li>
              Appuyez sur <strong>« Partager le lien… »</strong> → copiez
              l'URL → collez-la ici.
            </li>
          </ol>
          <p className="mt-3 font-medium">📅 Google Calendar</p>
          <ol className="ml-4 mt-2 list-decimal space-y-1 text-muted-foreground">
            <li>
              Sur le web : <strong>Paramètres → Calendriers → [votre
              calendrier] → Intégrer</strong>.
            </li>
            <li>
              Rendez le calendrier <strong>public</strong> et copiez l'URL
              au format iCal.
            </li>
          </ol>
          <p className="mt-3 text-xs italic text-muted-foreground">
            ⚠︎ Toute personne avec cette URL pourra voir les évènements.
            Ne l'utilisez que pour un calendrier dédié au pro.
          </p>
        </div>

        {initialUrl && (
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="font-medium">Basculer sur NG Gestion comme agenda principal</p>
            <p className="text-xs text-muted-foreground">
              Les rendez-vous du téléphone sont en lecture seule ici : on ne
              peut ni les déplacer ni les modifier. Reprenez-les en une fois :
              chaque RDV à venir devient un rendez-vous NG Gestion
              (déplaçable, modifiable, facturable) et sa copie téléphone
              disparaît de l&apos;agenda. Un RDV isolé se reprend aussi depuis
              sa fiche, dans l&apos;agenda.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" disabled={reprise}>
                  {reprise ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Reprendre tous les RDV à venir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reprendre tous les RDV à venir ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tous les rendez-vous du calendrier téléphone d&apos;aujourd&apos;hui
                    à dans un an deviennent des rendez-vous NG Gestion. Ceux
                    déjà repris sont ignorés. Rien n&apos;est modifié sur le
                    téléphone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={toutReprendre}>Reprendre</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSave} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Enregistrer l'URL
          </Button>
          {initialUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={pending}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Retirer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
