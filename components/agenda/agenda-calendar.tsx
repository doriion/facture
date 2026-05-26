"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, AlertCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getFrenchHolidays } from "@/lib/holidays-fr";
import {
  getColorClasses,
  getSwatchClass,
  DEFAULT_AGENDA_COULEURS,
  type AgendaCouleurs,
} from "@/lib/agenda-colors";
import type { AgendaEvent, AgendaData } from "@/lib/actions/agenda";
import {
  QuickInterventionDialog,
  type ClientOption,
  type InterventionEditData,
} from "@/components/agenda/quick-intervention-dialog";

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const JOURS_FR_SHORT = ["L", "M", "M", "J", "V", "S", "D"];
const JOURS_FR_FULL = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Génère la grille de 42 cases (6 lignes × 7 jours) pour le mois.
 * Semaine commence le lundi (norme FR).
 */
function buildMonthGrid(year: number, month1to12: number): Date[] {
  const firstDay = new Date(year, month1to12 - 1, 1);
  // getDay() : 0=dim, 1=lun, ... 6=sam → on veut 0=lun, 6=dim
  const offset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

function eventCoversDate(e: AgendaEvent, ymd: string): boolean {
  return ymd >= e.date_start && ymd <= e.date_end;
}

function eventColorClasses(e: AgendaEvent, couleurs: AgendaCouleurs): string {
  if (e.kind === "intervention") {
    return getColorClasses(
      e.facture_emise
        ? couleurs.intervention_facturee
        : couleurs.intervention_a_facturer,
    );
  }
  if (e.kind === "facture_prestation") {
    // Le statut nuance la couleur de base. Pour conserver une lecture
    // métier essentielle, on garde les statuts spéciaux en hard-coded
    // (retard = rouge, annulée = barré) ; le statut "courant" utilise
    // la couleur utilisateur.
    if (e.statut === "retard") {
      return "bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-100";
    }
    if (e.statut === "annulee") {
      return "bg-slate-100 text-slate-500 line-through hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400";
    }
    return getColorClasses(couleurs.facture);
  }
  if (e.kind === "devis_planifie") {
    return getColorClasses(couleurs.devis);
  }
  if (e.kind === "external") {
    return getColorClasses(couleurs.external);
  }
  // visite_maintenance
  return getColorClasses(couleurs.maintenance);
}

/** Convertit "HH:MM:SS" en "HH:MM" pour un affichage compact. */
function shortTime(t: string | null): string | null {
  if (!t) return null;
  return t.slice(0, 5);
}

/** Préfixe horaire affiché dans la pill ("09:00–12:00 · " ou "09:00 · " ou ""). */
function eventTimePrefix(e: AgendaEvent): string {
  const start = shortTime(e.heure_debut);
  const end = shortTime(e.heure_fin);
  if (start && end) return `${start}–${end} · `;
  if (start) return `${start} · `;
  return "";
}

function eventShortLabel(e: AgendaEvent): string {
  if (e.kind === "intervention") {
    // Priorité à la description saisie par l'utilisateur (c'est l'info la
    // plus parlante), avec le client en complément si la place reste.
    const base = e.description
      ? e.client_nom
        ? `${e.description} · ${e.client_nom}`
        : e.description
      : (e.client_nom ?? e.title);
    return eventTimePrefix(e) + base;
  }
  if (e.kind === "facture_prestation") {
    return `${e.numero ?? ""} ${e.client_nom ? "· " + e.client_nom : ""}`.trim();
  }
  if (e.kind === "devis_planifie") {
    return `${e.numero ?? ""} ${e.client_nom ? "· " + e.client_nom : ""}`.trim();
  }
  if (e.kind === "external") {
    return eventTimePrefix(e) + (e.title || "(évènement)");
  }
  return e.client_nom ? `Visite · ${e.client_nom}` : "Visite";
}

export function AgendaCalendar({
  data,
  clients,
  couleurs = DEFAULT_AGENDA_COULEURS,
}: {
  data: AgendaData;
  clients: ClientOption[];
  couleurs?: AgendaCouleurs;
}) {
  const router = useRouter();
  const { year, month, events, stats } = data;

  const todayYmd = useMemo(() => toYmd(new Date()), []);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  // Jours fériés FR du mois affiché (+ mois précédent/suivant pour les
  // cases débordantes de la grille).
  const holidays = useMemo(() => {
    const prevYear = month === 1 ? year - 1 : year;
    const nextYear = month === 12 ? year + 1 : year;
    return {
      ...getFrenchHolidays(prevYear),
      ...getFrenchHolidays(year),
      ...getFrenchHolidays(nextYear),
    };
  }, [year, month]);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState(todayYmd);
  const [editTarget, setEditTarget] = useState<InterventionEditData | null>(null);

  const openQuickAdd = (ymd: string) => {
    setEditTarget(null);
    setQuickAddDate(ymd);
    setQuickAddOpen(true);
  };

  const openEdit = (e: AgendaEvent) => {
    if (e.kind !== "intervention" || !e.client_id) return;
    setEditTarget({
      id: e.id,
      client_id: e.client_id,
      date_intervention: e.date_start,
      date_fin: e.date_end !== e.date_start ? e.date_end : null,
      heure_debut: e.heure_debut,
      heure_fin: e.heure_fin,
      type: e.type_activite ?? "installation",
      description: e.description,
    });
    setQuickAddOpen(true);
  };

  const goto = (y: number, m: number) => {
    router.push(`/agenda?year=${y}&month=${m}`);
  };

  const prevMonth = () => {
    if (month === 1) goto(year - 1, 12);
    else goto(year, month - 1);
  };
  const nextMonth = () => {
    if (month === 12) goto(year + 1, 1);
    else goto(year, month + 1);
  };
  const goToday = () => {
    const now = new Date();
    goto(now.getFullYear(), now.getMonth() + 1);
  };

  return (
    <div className="space-y-4">
      {/* Stats du mois */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <StatCard
          label="Interventions"
          value={stats.nbInterventions}
          hint={`dont ${stats.nbInterventionsAFacturer} à facturer`}
          tone={stats.nbInterventionsAFacturer > 0 ? "warning" : "default"}
        />
        <StatCard label="Factures" value={stats.nbFactures} hint="prestations facturées" />
        <StatCard label="Devis planifiés" value={stats.nbDevis} hint="travaux prévus" />
        <StatCard label="Visites maint." value={stats.nbVisites} hint="contrats" />
      </div>

      {/* Toolbar : navigation mois.
          Mobile : 2 lignes (nav + bouton Planifier en haut, légende dessous).
          Desktop : 1 ligne (nav à gauche, planifier + légende à droite). */}
      <div className="space-y-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={prevMonth}
            aria-label="Mois précédent"
            className="h-9 w-9"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            aria-label="Mois suivant"
            className="h-9 w-9"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="px-2 sm:px-3"
          >
            Aujourd'hui
          </Button>
          <h2 className="ml-auto text-sm font-semibold tracking-tight sm:ml-2 sm:text-lg">
            {MOIS_FR[month - 1]} {year}
          </h2>
          <Button
            size="sm"
            onClick={() => openQuickAdd(todayYmd)}
            className="sm:hidden"
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => openQuickAdd(todayYmd)}
            className="hidden sm:inline-flex"
          >
            <Plus className="size-4" />
            Planifier
          </Button>
          <Legend couleurs={couleurs} />
        </div>
      </div>

      {/* Erreur calendrier externe */}
      {data.externalCalendarError && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          ⚠︎ Impossible de récupérer votre calendrier téléphone :{" "}
          {data.externalCalendarError}
        </div>
      )}

      {/* Alerte interventions non facturées */}
      {stats.nbInterventionsAFacturer > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              {stats.nbInterventionsAFacturer} intervention
              {stats.nbInterventionsAFacturer > 1 ? "s" : ""} de ce mois
              {stats.nbInterventionsAFacturer > 1 ? " ne sont " : " n'est "}
              pas encore facturée
              {stats.nbInterventionsAFacturer > 1 ? "s" : ""}.
            </p>
            <p className="text-xs opacity-80">
              Repérables en orange dans le calendrier ci-dessous.
            </p>
          </div>
        </div>
      )}

      {/* Calendrier */}
      <Card>
        <CardContent className="p-0">
          {/* Entête jours */}
          <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {JOURS_FR_FULL.map((j, i) => (
              <div
                key={j}
                className={cn(
                  "px-1 py-2 sm:px-2",
                  (i === 5 || i === 6) && "text-orange-700 dark:text-orange-400",
                )}
              >
                <span className="sm:hidden">{JOURS_FR_SHORT[i]}</span>
                <span className="hidden sm:inline">{j}</span>
              </div>
            ))}
          </div>
          {/* Grille jours */}
          <div className="grid grid-cols-7">
            {grid.map((day, idx) => {
              const ymd = toYmd(day);
              const isCurrentMonth = day.getMonth() === month - 1;
              const isToday = ymd === todayYmd;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const holidayName = holidays[ymd] ?? null;
              const isHoliday = Boolean(holidayName);
              const dayEvents = events.filter((e) => eventCoversDate(e, ymd));

              return (
                <div
                  key={idx}
                  onClick={() => openQuickAdd(ymd)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      openQuickAdd(ymd);
                    }
                  }}
                  title={
                    holidayName
                      ? `${holidayName} — Cliquez pour planifier`
                      : "Cliquez pour planifier une intervention"
                  }
                  className={cn(
                    "group relative min-h-[70px] cursor-pointer border-b border-r p-1 text-xs transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[110px] sm:p-1.5",
                    idx % 7 === 6 && "border-r-0",
                    idx >= 35 && "border-b-0",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground/60",
                    isCurrentMonth && isWeekend && !isHoliday && "bg-orange-50/60 dark:bg-orange-950/10",
                    isCurrentMonth && isHoliday && "bg-rose-50 dark:bg-rose-950/20",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                        isToday && "bg-primary text-primary-foreground",
                        !isToday && isHoliday && "text-rose-700 dark:text-rose-300",
                        !isToday && !isHoliday && isWeekend && "text-orange-700 dark:text-orange-400",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {isCurrentMonth && dayEvents.length > 2 && (
                        <span className="text-[9px] text-muted-foreground sm:hidden">
                          +{dayEvents.length - 2}
                        </span>
                      )}
                      {isCurrentMonth && dayEvents.length > 3 && (
                        <span className="hidden text-[10px] text-muted-foreground sm:inline">
                          +{dayEvents.length - 3}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Plus className="size-3" />
                      </span>
                    </div>
                  </div>
                  {holidayName && isCurrentMonth && (
                    <div className="mb-1 truncate text-[10px] font-medium uppercase tracking-wide text-rose-700 dark:text-rose-400">
                      {holidayName}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e, evIdx) => {
                      const isIntervention = e.kind === "intervention";
                      const commonClass = cn(
                        "block w-full text-left line-clamp-1 break-words rounded px-1 py-0.5 text-[10px] leading-tight transition-colors sm:line-clamp-2 sm:px-1.5 sm:text-[11px]",
                        eventColorClasses(e, couleurs),
                        // 3e évènement masqué sur mobile pour gagner de la place
                        evIdx === 2 && "hidden sm:block",
                      );
                      const tooltip = `${e.description ? e.description + " — " : ""}${e.client_nom ?? e.title}${isIntervention ? "\n(Cliquez pour modifier)" : ""}`;
                      // Pour les interventions : clic ouvre le dialogue d'édition
                      // rapide (inline) plutôt que la fiche complète — plus rapide
                      // pour ajuster planning/description. Lien "Fiche complète"
                      // disponible dans le dialogue.
                      if (isIntervention) {
                        return (
                          <button
                            key={`${e.kind}-${e.id}-${ymd}`}
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              openEdit(e);
                            }}
                            className={commonClass}
                            title={tooltip}
                          >
                            {eventShortLabel(e)}
                          </button>
                        );
                      }
                      // Évènements externes (calendrier iPhone) : non
                      // cliquables — ce sont des copies lecture seule.
                      if (e.kind === "external") {
                        return (
                          <div
                            key={`${e.kind}-${e.id}-${ymd}`}
                            onClick={(ev) => ev.stopPropagation()}
                            className={cn(commonClass, "cursor-default opacity-90")}
                            title={`${e.title}${e.description ? "\n" + e.description : ""}\n(depuis votre calendrier téléphone)`}
                          >
                            📱 {eventShortLabel(e)}
                          </div>
                        );
                      }
                      return (
                        <Link
                          key={`${e.kind}-${e.id}-${ymd}`}
                          href={e.href}
                          onClick={(ev) => ev.stopPropagation()}
                          className={commonClass}
                          title={tooltip}
                        >
                          {eventShortLabel(e)}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cliquez sur une case du calendrier pour planifier une intervention,
        ou sur un évènement existant pour ouvrir sa fiche. Les interventions
        en{" "}
        <span className="font-medium text-amber-700 dark:text-amber-400">
          orange
        </span>{" "}
        n'ont pas encore de facture associée.
      </p>

      <QuickInterventionDialog
        open={quickAddOpen}
        onOpenChange={(next) => {
          setQuickAddOpen(next);
          if (!next) setEditTarget(null);
        }}
        date={editTarget?.date_intervention ?? quickAddDate}
        clients={clients}
        editIntervention={editTarget ?? undefined}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card className={tone === "warning" ? "border-amber-400" : undefined}>
      <CardContent className="p-3 sm:p-4">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
          {value}
        </div>
        {hint && (
          <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Legend({ couleurs }: { couleurs: AgendaCouleurs }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <LegendDot
        className={getSwatchClass(couleurs.intervention_facturee)}
        label="Facturée / payée"
      />
      <LegendDot
        className={getSwatchClass(couleurs.intervention_a_facturer)}
        label="À facturer"
      />
      <LegendDot
        className={getSwatchClass(couleurs.facture)}
        label="Facture"
      />
      <LegendDot className="bg-red-200" label="En retard" />
      <LegendDot
        className={getSwatchClass(couleurs.devis)}
        label="Devis planifié"
      />
      <LegendDot
        className={getSwatchClass(couleurs.maintenance)}
        label="Maintenance"
      />
      <LegendDot
        className={getSwatchClass(couleurs.external)}
        label="📱 Téléphone"
      />
      <LegendDot
        className="bg-rose-100 ring-1 ring-rose-300"
        label="Jour férié"
      />
      <LegendDot
        className="bg-orange-100 ring-1 ring-orange-300"
        label="Week-end"
      />
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <Badge variant="outline" className="gap-1.5 border-muted-foreground/20 font-normal">
      <span className={cn("inline-block size-2 rounded-full", className)} />
      {label}
    </Badge>
  );
}
