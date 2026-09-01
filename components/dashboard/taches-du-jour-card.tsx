import Link from "next/link";
import { ArrowRight, ListTodo } from "lucide-react";

import type { TacheDuJour } from "@/lib/actions/taches";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_AFFICHEES = 6;

/**
 * Bloc « À faire aujourd'hui » en tête du dashboard : tâches en retard
 * (rouge) puis échues aujourd'hui. Masqué quand il n'y a rien — le
 * dashboard n'a pas besoin d'une carte vide.
 */
export function TachesDuJourCard({ taches }: { taches: TacheDuJour[] }) {
  if (taches.length === 0) return null;

  const affichees = taches.slice(0, MAX_AFFICHEES);
  const reste = taches.length - affichees.length;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="size-4 text-primary" />
          À faire aujourd'hui
          <Badge variant="secondary">{taches.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {affichees.map((t) => (
          <Link
            key={t.id}
            href="/taches"
            className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            <span className="min-w-0 truncate">
              {t.titre}
              {t.heure ? (
                <span className="text-muted-foreground"> — {t.heure}</span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {t.priorite === "urgente" && (
                <Badge variant="warning">Urgent</Badge>
              )}
              {t.joursRetard > 0 && (
                <Badge variant="destructive">{t.joursRetard} j de retard</Badge>
              )}
            </span>
          </Link>
        ))}
        <Link
          href="/taches"
          className="flex items-center gap-1 px-2 pt-1 text-sm font-medium text-primary hover:underline"
        >
          {reste > 0 ? `Voir les ${taches.length} tâches` : "Ouvrir le pense-bête"}
          <ArrowRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
