import Link from "next/link";
import { Smartphone } from "lucide-react";

import { getAgendaEvents } from "@/lib/actions/agenda";
import { listClients } from "@/lib/actions/clients";
import { getProfil } from "@/lib/actions/profil";
import { normalizeCouleurs } from "@/lib/agenda-colors";
import { AgendaCalendar } from "@/components/agenda/agenda-calendar";

export const metadata = { title: "Agenda — Facture AE" };

export const dynamic = "force-dynamic";

function parseIntInRange(
  raw: string | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < min || n > max) return fallback;
  return n;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const now = new Date();
  const year = parseIntInRange(searchParams.year, 2000, 2100, now.getFullYear());
  const month = parseIntInRange(searchParams.month, 1, 12, now.getMonth() + 1);

  const [data, clientsAll, profil] = await Promise.all([
    getAgendaEvents(year, month),
    listClients(),
    getProfil(),
  ]);
  const clients = clientsAll.map((c) => ({ id: c.id, nom: c.nom }));
  const couleurs = normalizeCouleurs(profil?.agenda_couleurs);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            Vue calendrier de vos interventions, prestations facturées, devis
            planifiés et visites de maintenance. Repérez en un coup d'œil les
            interventions à facturer.
          </p>
        </div>
        <Link
          href="/parametres#calendar-sync"
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
        >
          <Smartphone className="size-3.5" />
          Synchroniser avec mon téléphone
        </Link>
      </div>

      <AgendaCalendar data={data} clients={clients} couleurs={couleurs} />
    </div>
  );
}
