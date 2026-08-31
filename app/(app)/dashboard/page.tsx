import { getDashboardData } from "@/lib/actions/dashboard";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CotisationsCard } from "@/components/dashboard/cotisations-card";
import { SeuilsMicroCard } from "@/components/dashboard/seuils-micro-card";
import { CaMensuelChart } from "@/components/dashboard/ca-mensuel-chart";
import { RepartitionActiviteChart } from "@/components/dashboard/repartition-activite-chart";
import { AlertesSection } from "@/components/dashboard/alertes-section";
import { TopClients } from "@/components/dashboard/top-clients";
import {
  DevisRecentsCard,
  FacturesRecentesCard,
} from "@/components/dashboard/recents-lists";

export const metadata = { title: "Tableau de bord — Facture AE" };

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble de votre activité — année {data.annee}
        </p>
      </div>

      <KpiCards
        caMois={data.caMois}
        caEncaisseMois={data.caEncaisseMois}
        caMoisPrecedent={data.caMoisPrecedent}
        caAnnee={data.caAnnee}
        nbFacturesImpayees={data.nbFacturesImpayees}
        montantImpaye={data.montantImpaye}
        nbDevisEnAttente={data.nbDevisEnAttente}
        tauxConversionDevis={data.tauxConversionDevis}
        annee={data.annee}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SeuilsMicroCard
          caEncaisseAnnee={data.caEncaisseAnnee}
          annee={data.annee}
        />
        <CotisationsCard cotisations={data.cotisations} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CaMensuelChart data={data.caParMois} />
        <RepartitionActiviteChart
          data={data.caParActivite}
          annee={data.annee}
        />
      </div>

      <AlertesSection
        facturesEnRetard={data.facturesEnRetard}
        devisExpirantBientot={data.devisExpirantBientot}
        prochainesVisitesMaintenance={data.prochainesVisitesMaintenance}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <FacturesRecentesCard factures={data.facturesRecentes} />
        <DevisRecentsCard devis={data.devisRecents} />
        <TopClients clients={data.topClients} annee={data.annee} />
      </div>
    </div>
  );
}
