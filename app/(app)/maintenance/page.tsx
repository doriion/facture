import { CalendarClock } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata = { title: "Maintenance — Facture AE" };

export default function MaintenancePage() {
  return (
    <PlaceholderPage
      title="Contrats de maintenance"
      description="Contrats d'entretien récurrents annuels ou semestriels pour vos clients clim/PAC."
      phase="en Phase 5"
      icon={CalendarClock}
    />
  );
}
