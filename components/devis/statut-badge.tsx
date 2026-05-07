import { Badge } from "@/components/ui/badge";
import { LABELS_STATUT_DEVIS } from "@/lib/legal-text";

const variantByStatut: Record<
  string,
  "default" | "secondary" | "outline" | "success" | "warning" | "destructive"
> = {
  brouillon: "outline",
  envoye: "default",
  accepte: "success",
  refuse: "destructive",
  expire: "warning",
};

export function StatutBadgeDevis({ statut }: { statut: string }) {
  return (
    <Badge variant={variantByStatut[statut] ?? "default"}>
      {LABELS_STATUT_DEVIS[statut as keyof typeof LABELS_STATUT_DEVIS] ?? statut}
    </Badge>
  );
}
