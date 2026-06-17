"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, Check, Loader2, Save, Smartphone, Wrench } from "lucide-react";
import { toast } from "sonner";

import {
  setFactureCoveredEventsAction,
  type ExternalEventLink,
} from "@/lib/actions/facture-events-couverts";
import { formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InterventionCandidate = {
  id: string;
  date_intervention: string;
  date_fin: string | null;
  description: string | null;
  type: string;
  client_nom: string | null;
  facture_id: string | null;
  already_linked_here: boolean;
};

export type ExternalCandidate = {
  uid: string;
  title: string;
  date_start: string;
  date_end: string;
  time_start: string | null;
  linked_facture_id: string | null;
  already_linked_here: boolean;
};

export function FactureEventsCouverts({
  factureId,
  interventions,
  externals,
  initialInterventionIds,
  initialExternalUids,
}: {
  factureId: string;
  interventions: InterventionCandidate[];
  externals: ExternalCandidate[];
  initialInterventionIds: string[];
  initialExternalUids: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [interventionsSelected, setInterventionsSelected] = useState<
    Set<string>
  >(new Set(initialInterventionIds));
  const [externalsSelected, setExternalsSelected] = useState<Set<string>>(
    new Set(initialExternalUids),
  );

  const toggleIntervention = (id: string) => {
    setInterventionsSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleExternal = (uid: string) => {
    setExternalsSelected((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const dirty =
    !setsEqual(interventionsSelected, new Set(initialInterventionIds)) ||
    !setsEqual(externalsSelected, new Set(initialExternalUids));

  function onSave() {
    startTransition(async () => {
      // Recompose les externals sélectionnés avec leur snapshot.
      const externalEvents: ExternalEventLink[] = externals
        .filter((e) => externalsSelected.has(e.uid))
        .map((e) => ({
          uid: e.uid,
          title: e.title,
          date_start: e.date_start,
          date_end: e.date_end,
        }));

      const res = await setFactureCoveredEventsAction(factureId, {
        interventionIds: Array.from(interventionsSelected),
        externalEvents,
      });
      if (res.ok) {
        toast.success(
          `${interventionsSelected.size + externalsSelected.size} évènement${interventionsSelected.size + externalsSelected.size > 1 ? "s" : ""} rattaché${interventionsSelected.size + externalsSelected.size > 1 ? "s" : ""}`,
        );
        router.refresh();
      } else {
        toast.error("Erreur", { description: res.error });
      }
    });
  }

  const totalSelected = interventionsSelected.size + externalsSelected.size;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Check className="size-4 text-primary" />
          Évènements couverts par cette facture
        </CardTitle>
        <CardDescription>
          Cochez les interventions de l'app et les RDV iPhone (📱) que cette
          facture couvre. Les évènements rattachés passeront en vert
          « facturé » sur l'agenda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Interventions */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Wrench className="size-3.5" />
            Interventions ({interventions.length})
          </div>
          {interventions.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Aucune intervention dans la fenêtre (±90 jours).
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {interventions.map((it) => {
                const blockedByOther =
                  it.facture_id && it.facture_id !== factureId;
                const checked = interventionsSelected.has(it.id);
                const label = it.description || it.type;
                return (
                  <label
                    key={it.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent/30",
                      blockedByOther && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={Boolean(blockedByOther)}
                      onChange={() => toggleIntervention(it.id)}
                      className="mt-0.5 size-4 rounded border-input accent-primary"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateFr(it.date_intervention)}
                        {it.date_fin && it.date_fin !== it.date_intervention && (
                          <> → {formatDateFr(it.date_fin)}</>
                        )}
                        {it.client_nom && (
                          <span className="ml-1">· {it.client_nom}</span>
                        )}
                        {blockedByOther && (
                          <span className="ml-1 italic text-amber-700 dark:text-amber-400">
                            (déjà liée à une autre facture)
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Externals (RDV iPhone) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Smartphone className="size-3.5" />
            RDV iPhone ({externals.length})
          </div>
          {externals.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Aucun RDV externe trouvé. Paramètres → « Importer mon
              calendrier téléphone » si vous ne l'avez pas encore configuré.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {externals.map((ev) => {
                const blockedByOther =
                  ev.linked_facture_id &&
                  ev.linked_facture_id !== factureId;
                const checked = externalsSelected.has(ev.uid);
                return (
                  <label
                    key={ev.uid}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent/30",
                      blockedByOther && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={Boolean(blockedByOther)}
                      onChange={() => toggleExternal(ev.uid)}
                      className="mt-0.5 size-4 rounded border-input accent-primary"
                    />
                    <div className="flex-1">
                      <div className="font-medium">📱 {ev.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateFr(ev.date_start)}
                        {ev.date_end !== ev.date_start && (
                          <> → {formatDateFr(ev.date_end)}</>
                        )}
                        {ev.time_start && (
                          <span className="ml-1">· {ev.time_start}</span>
                        )}
                        {blockedByOther && ev.linked_facture_id && (
                          <span className="ml-1 italic text-amber-700 dark:text-amber-400">
                            (déjà liée à{" "}
                            <Link
                              href={`/factures/${ev.linked_facture_id}`}
                              className="underline"
                            >
                              une autre facture
                            </Link>
                            )
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {totalSelected} évènement{totalSelected > 1 ? "s" : ""} sélectionné
            {totalSelected > 1 ? "s" : ""}
            {dirty && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                <Calendar className="size-2.5" />
                Modifications non enregistrées
              </span>
            )}
          </p>
          <Button onClick={onSave} disabled={pending || !dirty} size="sm">
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Enregistrer les liens
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  const values = Array.from(a);
  for (const v of values) if (!b.has(v)) return false;
  return true;
}
