import Link from "next/link";
import { Smartphone } from "lucide-react";

import { getAgendaEvents } from "@/lib/actions/agenda";
import { listClientsLegers } from "@/lib/actions/clients";
import { getProfil } from "@/lib/actions/profil";
import { getCouleursEvenements } from "@/lib/actions/agenda-couleurs";
import { aujourdhuiParis } from "@/lib/agenda-facturation";
import { normalizeCouleurs } from "@/lib/agenda-colors";
import {
  JOURS_LISTE,
  ajouterJours,
  dernierDuMois,
  normaliserVue,
  premierDuMois,
} from "@/lib/agenda-vues";
import { AgendaCalendar } from "@/components/agenda/agenda-calendar";

export const metadata = { title: "Agenda — NG Gestion" };

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
  searchParams: { year?: string; month?: string; vue?: string; date?: string };
}) {
  const now = new Date();
  // Date du jour en heure de Paris (le serveur tourne en UTC : entre
  // minuit et 2 h, la date UTC est encore la veille).
  const aujourdhui = aujourdhuiParis(now);
  // Date sélectionnée : ?date= (vues jour / semaine), sinon ?year&month
  // (anciens liens), sinon aujourd'hui.
  const dateParam = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? "")
    ? searchParams.date!
    : null;
  const year = dateParam
    ? Number(dateParam.slice(0, 4))
    : parseIntInRange(searchParams.year, 2000, 2100, now.getFullYear());
  const month = dateParam
    ? Number(dateParam.slice(5, 7))
    : parseIntInRange(searchParams.month, 1, 12, now.getMonth() + 1);
  const date =
    dateParam ??
    (searchParams.year || searchParams.month
      ? `${year}-${String(month).padStart(2, "0")}-01`
      : aujourdhui);
  const vue = normaliserVue(searchParams.vue);

  // Fenêtre chargée : le mois affiché ET ses deux voisins (le swipe d'un
  // mois à l'autre reste local), ET les 60 prochains jours (vue liste),
  // quel que soit le mois affiché. Les RDV iPhone sont chargés par le
  // client après l'affichage (getAgendaExternes).
  const moisPrecedent = month === 1 ? premierDuMois(year - 1, 12) : premierDuMois(year, month - 1);
  const moisSuivant = month === 12 ? dernierDuMois(year + 1, 1) : dernierDuMois(year, month + 1);
  const finListe = ajouterJours(aujourdhui, JOURS_LISTE);
  // ±7 jours autour des mois voisins : la grille du mois affiche jusqu'à
  // 6 jours des mois adjacents, qui restaient vides au swipe.
  const debutFenetre = ajouterJours(moisPrecedent, -7);
  const finFenetre = ajouterJours(moisSuivant, 7);
  const [data, clients, profil, couleursEvenements] = await Promise.all([
    getAgendaEvents(year, month, {
      depuis: debutFenetre < aujourdhui ? debutFenetre : aujourdhui,
      jusquau: finFenetre > finListe ? finFenetre : finListe,
    }),
    listClientsLegers(),
    getProfil(),
    getCouleursEvenements(),
  ]);
  const couleurs = normalizeCouleurs(profil?.agenda_couleurs);

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Agenda</h1>
          {/* Sur téléphone, l'agenda doit commencer tout en haut : pas
              de texte d'explication ni de gros lien. */}
          <p className="hidden text-sm text-muted-foreground sm:block">
            Vue calendrier de vos interventions, prestations facturées, devis
            planifiés et visites de maintenance. Repérez en un coup d'œil les
            interventions à facturer.
          </p>
        </div>
        <Link
          href="/parametres#calendar-sync"
          aria-label="Synchroniser avec mon téléphone"
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 sm:px-3"
        >
          <Smartphone className="size-3.5" />
          <span className="hidden sm:inline">Synchroniser avec mon téléphone</span>
        </Link>
      </div>

      <AgendaCalendar
        data={data}
        clients={clients}
        couleurs={couleurs}
        couleursEvenements={couleursEvenements}
        date={date}
        vueUrl={vue}
        externesCle={0}
        aujourdhui={aujourdhui}
      />
    </div>
  );
}
