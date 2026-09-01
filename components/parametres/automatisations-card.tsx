"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload, FlaskConical, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import {
  saveReglagesAutomatisationsAction,
  type LigneJournal,
  type ReglagesAutomatisations,
} from "@/lib/actions/automatisations";
import { sauvegarderMaintenantAction } from "@/lib/actions/sauvegarde";
import { formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Interrupteurs des automatisations + journal des exécutions.
 * TOUT est livré désactivé par défaut sauf la sauvegarde (aucun envoi
 * client) ; le mode SIMULATION est actif par défaut : les jobs
 * journalisent ce qu'ils auraient envoyé sans rien envoyer.
 */
export function AutomatisationsCard({
  reglages,
  journal,
}: {
  reglages: ReglagesAutomatisations;
  journal: LigneJournal[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...reglages,
    relances_delai_jours: String(reglages.relances_delai_jours),
    rappels_fenetre_jours: String(reglages.rappels_fenetre_jours),
  });
  const [saving, setSaving] = useState(false);
  const [backuping, setBackuping] = useState(false);

  async function onSave() {
    setSaving(true);
    const res = await saveReglagesAutomatisationsAction({
      ...form,
      relances_delai_jours: Number(form.relances_delai_jours),
      rappels_fenetre_jours: Number(form.rappels_fenetre_jours),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Automatisations enregistrées.");
    router.refresh();
  }

  async function onBackupNow() {
    setBackuping(true);
    const res = await sauvegarderMaintenantAction();
    setBackuping(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data.message);
    router.refresh();
  }

  const switchRow = (
    key:
      | "auto_sauvegarde_active"
      | "auto_relances_active"
      | "auto_rappels_active"
      | "auto_email_taches_active"
      | "automatisations_simulation",
    titre: string,
    description: string,
  ) => (
    <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-primary"
        checked={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
      />
      <span>
        <span className="font-medium">{titre}</span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatisations</CardTitle>
        <CardDescription>
          Tâches exécutées chaque matin (vers 7 h). Tout envoi aux clients
          reste en simulation tant que le mode ci-dessous est actif —
          activez les interrupteurs un par un, après vérification du
          journal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode simulation en tête — c'est LE garde-fou */}
        <div className="rounded-md border border-amber-600/40 bg-amber-500/10 p-3">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={form.automatisations_simulation}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  automatisations_simulation: e.target.checked,
                }))
              }
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                <FlaskConical className="size-4 text-amber-600" />
                Mode simulation (recommandé les premières semaines)
              </span>
              <span className="block text-xs text-muted-foreground">
                Les relances et rappels journalisent ce qu'ils AURAIENT
                envoyé, sans envoyer aucun email aux clients. La
                sauvegarde, elle, tourne réellement (aucun risque).
              </span>
            </span>
          </label>
        </div>

        {switchRow(
          "auto_sauvegarde_active",
          "Sauvegarde mensuelle automatique",
          "Le 1er du mois : export complet par email + dépôt dans le stockage privé (12 conservées). Activée par défaut — aucun envoi client.",
        )}

        <div className="space-y-2">
          {switchRow(
            "auto_relances_active",
            "Relances d'impayés automatiques",
            "Chaque matin : factures envoyées, échues depuis le délai ci-dessous, sans relance récente (15 j) — 2 relances automatiques maximum par facture, puis c'est à vous. Récapitulatif par email quand des relances partent.",
          )}
          <div className="flex items-center gap-2 pl-10 text-sm">
            <span className="text-muted-foreground">Relancer à partir de</span>
            <Input
              className="h-8 w-16 text-right"
              inputMode="numeric"
              value={form.relances_delai_jours}
              onChange={(e) =>
                setForm((f) => ({ ...f, relances_delai_jours: e.target.value }))
              }
            />
            <span className="text-muted-foreground">
              jours après l'échéance (défaut 15)
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {switchRow(
            "auto_rappels_active",
            "Rappels d'entretien aux clients",
            "Chaque matin : contrats actifs dont la visite approche, un seul rappel par échéance. Récapitulatif par email quand des rappels partent.",
          )}
          <div className="flex items-center gap-2 pl-10 text-sm">
            <span className="text-muted-foreground">Prévenir</span>
            <Input
              className="h-8 w-16 text-right"
              inputMode="numeric"
              value={form.rappels_fenetre_jours}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  rappels_fenetre_jours: e.target.value,
                }))
              }
            />
            <span className="text-muted-foreground">
              jours avant la visite (défaut 30)
            </span>
          </div>
        </div>

        {switchRow(
          "auto_email_taches_active",
          "Email « Tes tâches du jour »",
          "Chaque matin, s'il y a des tâches échues ou en retard dans le pense-bête : un email récapitulatif à VOUS (jamais aux clients — hors simulation). Activé par défaut.",
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Enregistrer les automatisations
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onBackupNow}
            disabled={backuping}
          >
            {backuping ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CloudDownload className="size-4" />
            )}
            Sauvegarder maintenant
          </Button>
        </div>

        {/* Journal */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Journal des exécutions</p>
          {journal.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucune exécution pour l'instant.
            </p>
          ) : (
            <div className="divide-y rounded-md border text-xs">
              {journal.map((j) => (
                <div key={j.id} className="flex items-start gap-2 p-2">
                  <span
                    className={
                      j.statut === "succes"
                        ? "mt-1 size-2 shrink-0 rounded-full bg-green-500"
                        : j.statut === "erreur"
                          ? "mt-1 size-2 shrink-0 rounded-full bg-red-500"
                          : "mt-1 size-2 shrink-0 rounded-full bg-muted-foreground/40"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {formatDateFr(j.date_execution)} — {j.tache}
                      {j.dry_run && (
                        <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-700">
                          simulation
                        </span>
                      )}
                    </p>
                    {j.details && (
                      <p className="break-words text-muted-foreground">
                        {j.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
