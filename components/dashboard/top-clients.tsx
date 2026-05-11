import Link from "next/link";
import { Users } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEuros } from "@/lib/format";

export function TopClients({
  clients,
  annee,
}: {
  clients: Array<{ id: string; nom: string; total: number; nbFactures: number }>;
  annee: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" />
          Top clients
        </CardTitle>
        <CardDescription>Année {annee}</CardDescription>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun client facturé cette année.
          </p>
        ) : (
          <div className="space-y-2">
            {clients.map((c, idx) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium">{c.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.nbFactures} facture{c.nbFactures > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <p className="font-medium tabular-nums">
                  {formatEuros(c.total)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
