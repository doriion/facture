"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

import { facturerInterventionAction } from "@/lib/actions/interventions";
import { Button } from "@/components/ui/button";

/**
 * Bouton « Facturer » de la fiche intervention.
 * - Si l'intervention n'est pas encore facturée : crée une facture brouillon
 *   pré-remplie et y redirige (l'intervention passe en « facturée »).
 * - Si elle l'est déjà : propose d'ouvrir la facture liée.
 */
export function FacturerInterventionButton({
  interventionId,
  factureId,
}: {
  interventionId: string;
  factureId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (factureId) {
    return (
      <Button variant="outline" asChild>
        <Link href={`/factures/${factureId}`}>
          <FileText className="size-4" />
          Voir la facture
        </Link>
      </Button>
    );
  }

  async function onClick() {
    setPending(true);
    const result = await facturerInterventionAction(interventionId);
    setPending(false);
    if (result.ok) {
      toast.success(`Facture ${result.data.numero} créée`, {
        description: "Complétez les montants puis envoyez-la au client.",
      });
      router.push(`/factures/${result.data.factureId}`);
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  return (
    <Button onClick={onClick} disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Receipt className="size-4" />
      )}
      Facturer
    </Button>
  );
}
