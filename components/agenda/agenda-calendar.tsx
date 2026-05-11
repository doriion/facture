"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgendaEvent, AgendaData } from "@/lib/actions/agenda";

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const JOURS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

function eventColorClasses(e: AgendaEvent): string {
  if (e.kind === "intervention") {
    return e.facture_emise
      ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100"
      : "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100";
  }
  if (e.kind === "facture_prestation") {
    switch (e.statut) {
      case "payee":
        return "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100";
      case "retard":
        return "bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-100";
      case "envoyee":
        return "bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-100";
      case "brouillon":
        return "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200";
      case "annulee":
        return "bg-slate-100 text-slate-500 line-through hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400";
      default:
        return "bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-100";
    }
  }
  if (e.kind === "devis_planifie") {
    return "bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-100";
  }
  // visite_maintenance
  return "bg-cyan-100 text-cyan-900 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-100";
}

function eventShortLabel(e: AgendaEvent): string {
  if (e.kind === "intervention") {
    return e.client_nom ? `${e.client_nom}` : e.title;
  }
  if (e.kind === "facture_prestation") {
    return `${e.numero ?? ""} ${e.client_nom ? "· " + e.client_nom : ""}`.trim();
  }
  if (e.kind === "devis_planifie") {
    return `${e.numero ?? ""} ${e.client_nom ? "· " + e.client_nom : ""}`.trim();
  }
  return e.client_nom ? `Visite · ${e.client_nom}` : "Visite";
}

export function AgendaCalendar({ data }: { data: AgendaData }) {
  const router = useRouter();
  const { year, month, events, stats } = data;

  const todayYmd = useMemo(() => toYmd(new Date()), []);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

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
      <div className="grid gap-3 md:grid-cols-4">
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

      {/* Toolbar : navigation mois */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Mois précédent">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Mois suivant">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            Aujourd'hui
          </Button>
          <h2 className="ml-2 text-lg font-semibold tracking-tight">
            {MOIS_FR[month - 1]} {year}
          </h2>
        </div>
        <Legend />
      </div>

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
            {JOURS_FR.map((j) => (
              <div key={j} className="px-2 py-2">
                {j}
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
              const dayEvents = events.filter((e) => eventCoversDate(e, ymd));

              return (
                <div
                  key={idx}
                  className={cn(
                    "min-h-[110px] border-b border-r p-1.5 text-xs",
                    idx % 7 === 6 && "border-r-0",
                    idx >= 35 && "border-b-0",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground/60",
                    isCurrentMonth && isWeekend && "bg-muted/10",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                        isToday && "bg-primary text-primary-foreground",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {isCurrentMonth && dayEvents.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <Link
                        key={`${e.kind}-${e.id}-${ymd}`}
                        href={e.href}
                        className={cn(
                          "block truncate rounded px-1.5 py-0.5 text-[11px] leading-tight transition-colors",
                          eventColorClasses(e),
                        )}
                        title={`${e.title}${e.client_nom ? " — " + e.client_nom : ""}`}
                      >
                        {eventShortLabel(e)}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cliquez sur un évènement pour ouvrir la fiche correspondante. Les
        interventions en{" "}
        <span className="font-medium text-amber-700 dark:text-amber-400">
          orange
        </span>{" "}
        n'ont pas encore de facture associée.
      </p>

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
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <LegendDot className="bg-emerald-200" label="Facturée / payée" />
      <LegendDot className="bg-amber-200" label="À facturer" />
      <LegendDot className="bg-blue-200" label="Facture envoyée" />
      <LegendDot className="bg-red-200" label="En retard" />
      <LegendDot className="bg-violet-200" label="Devis planifié" />
      <LegendDot className="bg-cyan-200" label="Maintenance" />
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
