"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Palette, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { saveAgendaCouleursAction } from "@/lib/actions/profil";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DEFAULT_AGENDA_COULEURS,
  styleEvenement,
  type AgendaCategory,
  type AgendaCouleurs,
} from "@/lib/agenda-colors";
import { SelecteurCouleur } from "@/components/agenda/selecteur-couleur";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

/** Exemple affiché dans l'aperçu de chaque type. */
const APERCUS: Record<AgendaCategory, string> = {
  intervention_facturee: "09:00–12:00 · Entretien PAC · M. Martin",
  intervention_a_facturer: "14:00 · Pose monosplit · Mme Rossi",
  facture: "FAC-2026-0031 · SCI Les Érables",
  retard: "FAC-2026-0018 · M. Durand",
  devis: "DEV-2026-0060 · Mme Durand",
  maintenance: "Visite · Résidence Les Cèdres",
  external: "⚠︎📱 10:30 · Dépannage chaudière",
  ferie: "Case du calendrier teintée",
  weekend: "Case du calendrier teintée",
};

/**
 * Couleurs de l'agenda, par type d'évènement : palette proposée + choix
 * libre, aperçu de la pastille (texte adapté automatiquement au fond),
 * « Réinitialiser les couleurs par défaut ». Les couleurs sont
 * enregistrées dans le profil (par utilisateur) et s'appliquent au
 * calendrier ET à la légende.
 */
export function AgendaCouleursCard({
  initialCouleurs,
}: {
  initialCouleurs: AgendaCouleurs;
}) {
  const router = useRouter();
  const [couleurs, setCouleurs] = useState<AgendaCouleurs>(initialCouleurs);
  const [pending, startTransition] = useTransition();

  const setColor = (cat: AgendaCategory, hex: string) =>
    setCouleurs((c) => ({ ...c, [cat]: hex }));

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveAgendaCouleursAction(couleurs);
      if (res.ok) {
        toast.success("Couleurs enregistrées", {
          description: "Visibles dans l'agenda et sa légende.",
        });
        router.refresh();
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  };

  return (
    <Card id="couleurs-agenda">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-5 text-primary" />
          Couleurs de l&apos;agenda
        </CardTitle>
        <CardDescription>
          Choisissez la couleur de chaque type d&apos;évènement : palette ou
          couleur libre. Le texte passe automatiquement en sombre ou en clair
          pour rester lisible, en mode clair comme en mode sombre. Un
          évènement précis peut aussi recevoir sa propre couleur depuis
          l&apos;agenda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <span
                className="inline-block size-4 rounded border border-black/10 dark:border-white/15"
                style={styleEvenement(couleurs[cat])}
                aria-hidden="true"
              />
              {CATEGORY_LABELS[cat]}
            </Label>
            <SelecteurCouleur
              valeur={couleurs[cat]}
              onChange={(hex) => setColor(cat, hex)}
              nom={CATEGORY_LABELS[cat]}
              apercu={APERCUS[cat]}
            />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button onClick={handleSave} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Enregistrer les couleurs
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCouleurs(DEFAULT_AGENDA_COULEURS)}
            disabled={pending}
          >
            <RotateCcw className="size-4" />
            Réinitialiser les couleurs par défaut
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
