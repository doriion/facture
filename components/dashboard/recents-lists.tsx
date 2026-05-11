import Link from "next/link";
import { FileSignature, FileText } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatutBadge } from "@/components/factures/statut-badge";
import { StatutBadgeDevis } from "@/components/devis/statut-badge";
import { statutAffichageDevis } from "@/lib/validations/devis";
import { formatDateFr, formatEuros } from "@/lib/format";

export function FacturesRecentesCard({
  factures,
}: {
  factures: Array<{
    id: string;
    numero: string;
    date_emission: string;
    total_ht: number;
    statut: string;
    client_nom: string | null;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 text-primary" />
          Dernières factures
        </CardTitle>
        <CardDescription>
          <Link href="/factures" className="hover:underline">
            Voir toutes →
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {factures.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune facture.</p>
        ) : (
          <div className="space-y-1.5">
            {factures.map((f) => (
              <Link
                key={f.id}
                href={`/factures/${f.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-medium">{f.numero}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.client_nom ?? "—"} · {formatDateFr(f.date_emission)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatutBadge statut={f.statut} />
                  <p className="w-20 text-right font-medium tabular-nums">
                    {formatEuros(f.total_ht)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DevisRecentsCard({
  devis,
}: {
  devis: Array<{
    id: string;
    numero: string;
    date_emission: string;
    date_validite: string;
    total_ht: number;
    statut: string;
    client_nom: string | null;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="size-4 text-primary" />
          Derniers devis
        </CardTitle>
        <CardDescription>
          <Link href="/devis" className="hover:underline">
            Voir tous →
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {devis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun devis.</p>
        ) : (
          <div className="space-y-1.5">
            {devis.map((d) => (
              <Link
                key={d.id}
                href={`/devis/${d.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-medium">{d.numero}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.client_nom ?? "—"} · {formatDateFr(d.date_emission)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatutBadgeDevis
                    statut={statutAffichageDevis(d.statut, d.date_validite)}
                  />
                  <p className="w-20 text-right font-medium tabular-nums">
                    {formatEuros(d.total_ht)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
