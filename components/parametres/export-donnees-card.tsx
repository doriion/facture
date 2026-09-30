import { Download, FolderArchive } from "lucide-react";

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
 * devis + lignes, paiements, produits, interventions, contrats, profil)
 * et, à part, l'archive des fichiers (PDF signés, signatures, CERFA,
 * bons, logo, photos).
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
          format JSON, et l&apos;archive de vos fichiers (contrats signés,
          signatures, CERFA, bons, logo, photos). Les factures doivent être
          conservées 10 ans — faites cette sauvegarde régulièrement et
          stockez-la en dehors de l&apos;application. Ces fichiers
          contiennent vos prix d&apos;achat : ne les transmettez jamais à un
          client.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href="/api/exports/backup" download>
            <Download />
            Exporter mes données (JSON)
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href="/api/exports/backup-fichiers" download>
            <FolderArchive />
            Exporter mes fichiers (ZIP)
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
