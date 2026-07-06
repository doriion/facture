import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Carte « Sauvegarde des données » : télécharge un JSON complet de
 * toutes les données de l'utilisateur (clients, factures + lignes,
 * devis + lignes, paiements, produits, interventions, contrats, profil).
 *
 * Rappel légal : les factures doivent être conservées 10 ans — cette
 * sauvegarde est une copie indépendante de Supabase, à ranger en lieu
 * sûr (disque externe, cloud personnel).
 */
export function ExportDonneesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sauvegarde des données</CardTitle>
        <CardDescription>
          Téléchargez une copie complète de vos données (clients, factures,
          devis, paiements, produits, interventions, contrats, profil) au
          format JSON. Les factures doivent être conservées 10 ans —
          pensez à faire cette sauvegarde régulièrement et à la stocker en
          dehors de l&apos;application. Les fichiers image (logo, photos
          d&apos;intervention) ne sont pas inclus.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <a href="/api/exports/backup" download>
            <Download />
            Exporter mes données (JSON)
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
