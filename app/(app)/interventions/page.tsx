import { Wrench } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata = { title: "Interventions — Facture AE" };

export default function InterventionsPage() {
  return (
    <PlaceholderPage
      title="Interventions"
      description="Suivi des chantiers et traçabilité des fluides frigorigènes (F-Gas)."
      phase="en Phase 5"
      icon={Wrench}
    />
  );
}
