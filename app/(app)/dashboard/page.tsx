import { LayoutDashboard } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata = { title: "Tableau de bord — Facture AE" };

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Tableau de bord"
      description="Vue d'ensemble de votre activité — chiffre d'affaires, factures, devis."
      phase="en Phase 7"
      icon={LayoutDashboard}
    />
  );
}
