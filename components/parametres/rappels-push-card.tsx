"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Loader2, Send, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  enregistrerAbonnementPushAction,
  envoyerPushTestAction,
  saveReglagesRappelsPushAction,
  supprimerAbonnementPushAction,
  type AppareilPush,
  type ReglagesRappelsPush,
} from "@/lib/actions/push";
import {
  abonnementExistant,
  etatPush,
  nomAppareil,
  sAbonner,
  seDesabonner,
  type EtatPush,
} from "@/lib/push/navigateur";
import { DELAIS_RAPPEL } from "@/lib/rappels-push";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Rappels push : notification sur le téléphone avant chaque rendez-vous.
 * DÉSACTIVÉ par défaut. Deux choses à faire : activer l'interrupteur
 * (réglage du compte) et abonner CET appareil (permission du navigateur,
 * un appareil à la fois). Rien n'est envoyé aux clients.
 */
export function RappelsPushCard({
  reglages,
  appareils,
}: {
  reglages: ReglagesRappelsPush;
  appareils: AppareilPush[];
}) {
  const router = useRouter();
  const [actif, setActif] = useState(reglages.actif);
  const [delai, setDelai] = useState(String(reglages.delai_minutes));
  const [saving, setSaving] = useState(false);
  const [etat, setEtat] = useState<EtatPush | null>(null);
  const [endpointLocal, setEndpointLocal] = useState<string | null>(null);
  const [abonnementEnCours, setAbonnementEnCours] = useState(false);
  const [testEnCours, setTestEnCours] = useState(false);

  useEffect(() => {
    setEtat(etatPush());
    abonnementExistant()
      .then((a) => setEndpointLocal(a?.endpoint ?? null))
      .catch(() => {});
  }, []);

  const cetAppareilAbonne =
    endpointLocal !== null && appareils.some((a) => a.endpoint === endpointLocal);
  const configure = Boolean(reglages.clePublique);

  async function onSave() {
    setSaving(true);
    const res = await saveReglagesRappelsPushAction({ actif, delai_minutes: Number(delai) });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(actif ? "Rappels activés." : "Rappels désactivés.");
    router.refresh();
  }

  async function onAbonner() {
    setAbonnementEnCours(true);
    const r = await sAbonner(reglages.clePublique);
    if (!r.ok) {
      setAbonnementEnCours(false);
      setEtat(etatPush());
      toast.error(r.erreur);
      return;
    }
    const res = await enregistrerAbonnementPushAction({ ...r.abonnement, appareil: nomAppareil() });
    setAbonnementEnCours(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setEndpointLocal(r.abonnement.endpoint);
    toast.success("Cet appareil recevra les rappels.");
    router.refresh();
  }

  async function onRetirer(a: AppareilPush) {
    if (a.endpoint === endpointLocal) {
      await seDesabonner().catch(() => null);
      setEndpointLocal(null);
    }
    const res = await supprimerAbonnementPushAction(a.endpoint);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Appareil retiré.");
    router.refresh();
  }

  async function onTester() {
    setTestEnCours(true);
    const res = await envoyerPushTestAction();
    setTestEnCours(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Notification de test envoyée à ${res.data.envoyes} appareil(s).`,
      res.data.expires > 0
        ? { description: `${res.data.expires} abonnement(s) expiré(s) retiré(s).` }
        : undefined,
    );
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-5" />
          Rappels sur le téléphone
        </CardTitle>
        <CardDescription>
          Une notification avant chaque rendez-vous, envoyée par l&apos;app
          installée — sans passer par l&apos;abonnement calendrier de
          l&apos;iPhone. Rien n&apos;est envoyé aux clients. Désactivé par
          défaut.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configure && (
          <p className="rounded-md border border-amber-600/40 bg-amber-500/10 p-3 text-sm">
            Les clés de notification ne sont pas encore configurées sur le
            serveur (variables VAPID). Les réglages ci-dessous sont
            enregistrés mais rien ne partira tant qu&apos;elles manquent.
          </p>
        )}

        {/* 1. Le réglage du compte */}
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={actif}
            onChange={(e) => setActif(e.target.checked)}
          />
          <span>
            <span className="font-medium">Envoyer un rappel avant chaque rendez-vous</span>
            <span className="block text-xs text-muted-foreground">
              Rendez-vous horodatés : à l&apos;avance choisie ci-dessous.
              Journée entière : la veille à 18 h.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>Prévenir</span>
          <Select value={delai} onValueChange={setDelai}>
            <SelectTrigger className="w-40" aria-label="Délai du rappel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DELAIS_RAPPEL.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d < 60 ? `${d} min avant` : `${d / 60} h avant`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>

        {/* 2. Les appareils */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Appareils qui reçoivent les rappels</p>
          {appareils.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun appareil pour l&apos;instant. Abonnez celui-ci ci-dessous,
              depuis l&apos;app installée sur votre téléphone.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {appareils.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Smartphone className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{a.appareil ?? "Appareil"}</span>
                    {a.endpoint === endpointLocal && (
                      <span className="ml-1 text-xs text-primary">(celui-ci)</span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      Abonné le {formatDateFr(a.created_at)}
                      {a.derniere_utilisation
                        ? ` · dernier rappel le ${formatDateFr(a.derniere_utilisation)}`
                        : ""}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => onRetirer(a)}
                    aria-label={`Retirer ${a.appareil ?? "cet appareil"}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {etat === "safari-non-installe" && (
            <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Sur iPhone, les notifications ne fonctionnent que depuis
              l&apos;app ajoutée à l&apos;écran d&apos;accueil : Safari →
              Partager → « Sur l&apos;écran d&apos;accueil », puis ouvrez
              NG Gestion depuis l&apos;icône et revenez ici.
            </p>
          )}
          {etat === "non-supporte" && (
            <p className="text-xs text-muted-foreground">
              Ce navigateur ne prend pas en charge les notifications.
            </p>
          )}
          {etat === "refuse" && (
            <p className="text-xs text-destructive">
              Notifications refusées pour ce site : autorisez-les dans les
              réglages du navigateur, puis réessayez.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {etat === "pret" && !cetAppareilAbonne && (
              <Button
                type="button"
                variant="outline"
                onClick={onAbonner}
                disabled={abonnementEnCours || !configure}
              >
                {abonnementEnCours ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}
                Recevoir les rappels sur cet appareil
              </Button>
            )}
            {appareils.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={onTester}
                disabled={testEnCours || !configure}
              >
                {testEnCours ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Envoyer une notification de test
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
