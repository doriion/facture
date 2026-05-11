import { getAgendaEvents } from "@/lib/actions/agenda";
import { listClients } from "@/lib/actions/clients";
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

  const [data, clientsAll] = await Promise.all([
    getAgendaEvents(year, month),
    listClients(),
  ]);
  const clients = clientsAll.map((c) => ({ id: c.id, nom: c.nom }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Vue calendrier de vos interventions, prestations facturées, devis
          planifiés et visites de maintenance. Repérez en un coup d'œil les
          interventions à facturer.
        </p>
      </div>

      <AgendaCalendar data={data} clients={clients} />
    </div>
  );
}
