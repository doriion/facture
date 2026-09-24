import Link from "next/link";
import { History } from "lucide-react";

import { listInterventionsClient } from "@/lib/actions/interventions";
import { formatDateFr } from "@/lib/format";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * « Déjà vu chez ce client » : les dernières interventions chez le même
 * client, avec le matériel et la facture. Sur un dépannage, c'est ce
 * qu'on cherche en premier (qu'est-ce qui a été fait, sur quoi, quand).
 * Composant serveur : une requête, rien si aucun historique.
 */
export async function HistoriqueClientCard({
  clientId,
  clientNom,
  interventionId,
}: {
  clientId: string;
  clientNom: string;
  interventionId: string;
}) {
  const historique = await listInterventionsClient(clientId, interventionId, 5);
  if (historique.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4 text-primary" />
          Déjà vu chez {clientNom}
        </CardTitle>
        <CardDescription>
          Les dernières interventions chez ce client.{" "}
          <Link href={`/clients/${clientId}`} className="underline">
            Toute la fiche
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {historique.map((i) => {
            const materiel = [i.equipement_marque, i.equipement_modele, i.equipement_num_serie]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={i.id}>
                <Link href={`/interventions/${i.id}`} className="block py-2 text-sm hover:bg-accent/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {LABELS_TYPE_INTERVENTION[i.type as keyof typeof LABELS_TYPE_INTERVENTION] ?? i.type}{" "}
                      du {formatDateFr(i.date_intervention)}
                    </span>
                    {i.facture && (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {i.facture.numero}
                      </span>
                    )}
                  </div>
                  {i.description && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{i.description}</p>
                  )}
                  {materiel && <p className="text-xs text-muted-foreground">{materiel}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
