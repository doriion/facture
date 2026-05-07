import { Badge } from "@/components/ui/badge";
import { LABELS_STATUT_FACTURE } from "@/lib/legal-text";

const variantByStatut: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  brouillon: "outline",
  envoyee: "default",
  payee: "success",
  retard: "warning",
  annulee: "destructive",
};

export function StatutBadge({ statut }: { statut: string }) {
  return (
    <Badge variant={variantByStatut[statut] ?? "default"}>
      {LABELS_STATUT_FACTURE[statut as keyof typeof LABELS_STATUT_FACTURE] ??
        statut}
    </Badge>
  );
}
