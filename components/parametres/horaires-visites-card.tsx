"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { saveHorairesVisitesAction } from "@/lib/actions/profil";
import { LABELS_JOURS, horairesParDefaut, horairesVisitesSchema, type HorairesVisites } from "@/lib/horaires-visites";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Horaires proposés aux clients pour les visites d'entretien : jours
 * travaillés et tranches matin / après-midi. Les créneaux envoyés par
 * e-mail (manuellement ou par l'automatisation) les respectent.
 */
export function HorairesVisitesCard({ horaires }: { horaires: HorairesVisites }) {
  const router = useRouter();
  const [valeur, setValeur] = useState<HorairesVisites>(horaires);
  const [enCours, demarrer] = useTransition();

  const basculerJour = (j: number) =>
    setValeur((h) => ({ ...h, jours: h.jours.includes(j) ? h.jours.filter((x) => x !== j) : [...h.jours, j].sort((a, b) => a - b) }));
  const tranche = (cle: "matin" | "apres_midi", champ: "debut" | "fin", v: string) =>
    setValeur((h) => ({ ...h, [cle]: { ...(h[cle] ?? { debut: "08:00", fin: "12:00" }), [champ]: v } }));
  const basculerTranche = (cle: "matin" | "apres_midi") =>
    setValeur((h) => ({ ...h, [cle]: h[cle] ? null : cle === "matin" ? { debut: "08:00", fin: "12:00" } : { debut: "14:00", fin: "18:00" } }));

  function enregistrer() {
    const parsed = horairesVisitesSchema.safeParse(valeur);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Horaires invalides.");
      return;
    }
    demarrer(async () => {
      const res = await saveHorairesVisitesAction(parsed.data);
      if (!res.ok) {
        toast.error("Horaires non enregistrés", { description: res.error });
        return;
      }
      toast.success("Horaires enregistrés");
      router.refresh();
    });
  }

  const Tranche = ({ cle, libelle }: { cle: "matin" | "apres_midi"; libelle: string }) => {
    const t = valeur[cle];
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex w-36 cursor-pointer items-center gap-2">
          <input type="checkbox" className="size-4 accent-primary" checked={Boolean(t)} onChange={() => basculerTranche(cle)} />
          <span className="font-medium">{libelle}</span>
        </label>
        <span className="text-muted-foreground">de</span>
        <Input type="time" className="h-9 w-28" value={t?.debut ?? ""} disabled={!t} onChange={(e) => tranche(cle, "debut", e.target.value)} />
        <span className="text-muted-foreground">à</span>
        <Input type="time" className="h-9 w-28" value={t?.fin ?? ""} disabled={!t} onChange={(e) => tranche(cle, "fin", e.target.value)} />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" />
          Créneaux proposés aux clients
        </CardTitle>
        <CardDescription>
          Pour les visites d&apos;entretien : les clients choisissent parmi ces demi-journées, sur vos jours
          travaillés, hors rendez-vous déjà posés dans l&apos;agenda et sur le téléphone.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((j) => {
            const actif = valeur.jours.includes(j);
            return (
              <button
                key={j}
                type="button"
                onClick={() => basculerJour(j)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${actif ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                aria-pressed={actif}
              >
                {LABELS_JOURS[j]}
              </button>
            );
          })}
        </div>
        <Tranche cle="matin" libelle="Matin" />
        <Tranche cle="apres_midi" libelle="Après-midi" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={enregistrer} disabled={enCours}>
            {enCours ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Enregistrer
          </Button>
          <Button type="button" variant="outline" onClick={() => setValeur(horairesParDefaut())} disabled={enCours}>
            <RotateCcw className="size-4" />
            Valeurs par défaut
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
