"use client";

import { useState, useTransition } from "react";
import { Palette, Save, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveAgendaCouleursAction } from "@/lib/actions/profil";
import {
  CATEGORY_LABELS,
  DEFAULT_AGENDA_COULEURS,
  PALETTE_LABELS,
  PALETTE_ORDER,
  getSwatchClass,
  type AgendaCategory,
  type AgendaCouleurs,
  type PaletteColor,
} from "@/lib/agenda-colors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const CATEGORIES: AgendaCategory[] = [
  "intervention_a_facturer",
  "intervention_facturee",
  "facture",
  "devis",
  "maintenance",
];

export function AgendaCouleursCard({
  initialCouleurs,
}: {
  initialCouleurs: AgendaCouleurs;
}) {
  const [couleurs, setCouleurs] = useState<AgendaCouleurs>(initialCouleurs);
  const [pending, startTransition] = useTransition();

  const setColor = (cat: AgendaCategory, color: PaletteColor) => {
    setCouleurs((c) => ({ ...c, [cat]: color }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveAgendaCouleursAction(couleurs);
      if (res.ok) {
        toast.success("Couleurs enregistrées");
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  };

  const handleReset = () => {
    setCouleurs(DEFAULT_AGENDA_COULEURS);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-5 text-primary" />
          Couleurs de l'agenda
        </CardTitle>
        <CardDescription>
          Choisissez la couleur de chaque type d'évènement affiché dans le
          calendrier. Visible immédiatement sur la page Agenda après
          enregistrement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <span
                className={cn(
                  "inline-block size-4 rounded",
                  getSwatchClass(couleurs[cat]),
                )}
                aria-hidden="true"
              />
              {CATEGORY_LABELS[cat]}
            </Label>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {PALETTE_ORDER.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setColor(cat, color)}
                  title={PALETTE_LABELS[color]}
                  aria-label={`${PALETTE_LABELS[color]} pour ${CATEGORY_LABELS[cat]}`}
                  className={cn(
                    "h-8 rounded-md border-2 transition-all",
                    getSwatchClass(color),
                    couleurs[cat] === color
                      ? "border-foreground ring-2 ring-offset-2 ring-foreground/30"
                      : "border-transparent hover:scale-105",
                  )}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Enregistrer les couleurs
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={pending}
          >
            <RotateCcw className="size-4" />
            Réinitialiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
