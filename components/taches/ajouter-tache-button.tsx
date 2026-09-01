import Link from "next/link";
import { ListTodo } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Bouton « Ajouter une tâche » des fiches (client, intervention, devis,
 * facture) : renvoie vers /taches avec le tiroir de création ouvert et
 * le lien pré-rempli. Server-friendly (simple lien).
 */
export function AjouterTacheButton({
  lienLabel,
  titre,
  clientId,
  interventionId,
  devisId,
  factureId,
}: {
  lienLabel: string;
  titre?: string;
  clientId?: string;
  interventionId?: string;
  devisId?: string;
  factureId?: string;
}) {
  const params = new URLSearchParams({ ajouter: "1", lien_label: lienLabel });
  if (titre) params.set("titre", titre);
  if (clientId) params.set("client_id", clientId);
  if (interventionId) params.set("intervention_id", interventionId);
  if (devisId) params.set("devis_id", devisId);
  if (factureId) params.set("facture_id", factureId);

  return (
    <Button variant="outline" asChild>
      <Link href={`/taches?${params.toString()}`}>
        <ListTodo className="size-4" />
        Ajouter une tâche
      </Link>
    </Button>
  );
}
