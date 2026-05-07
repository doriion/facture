import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Carte "à venir" générique utilisée pour les pages dont le contenu
 * sera implémenté en Phases 2 à 7.
 */
export function PlaceholderPage({
  title,
  description,
  phase,
  icon: Icon = Construction,
}: {
  title: string;
  description: string;
  phase: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle>Disponible {phase}</CardTitle>
            <CardDescription>
              Le squelette est posé, le contenu arrive bientôt.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cette page sera implémentée à la phase indiquée. La base de données
            est déjà prête : toutes les tables nécessaires sont créées et
            sécurisées par RLS.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
