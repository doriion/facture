import { ProfilForm } from "@/components/parametres/profil-form";
import { LogoUpload } from "@/components/parametres/logo-upload";
import { CalendarSyncCard } from "@/components/parametres/calendar-sync-card";
import { AgendaCouleursCard } from "@/components/parametres/agenda-couleurs-card";
import { ResetNumerotationCard } from "@/components/parametres/reset-numerotation-card";
import { normalizeCouleurs } from "@/lib/agenda-colors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLogoUrl, getProfil } from "@/lib/actions/profil";

export const metadata = { title: "Paramètres — Facture AE" };

/**
 * Page Paramètres : profil entreprise complet de l'auto-entrepreneur.
 * Server Component — fetch direct, hydrate le ProfilForm (client).
 */
export default async function ParametresPage() {
  const profil = await getProfil();
  const logoUrl = await getLogoUrl(profil?.logo_url);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Vos informations professionnelles. Elles apparaîtront sur toutes
          vos factures et devis.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Téléversez votre logo professionnel (apparaîtra en en-tête des PDF).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUpload currentLogoUrl={logoUrl} />
        </CardContent>
      </Card>

      <CalendarSyncCard initialToken={profil?.calendar_token ?? null} />

      <AgendaCouleursCard
        initialCouleurs={normalizeCouleurs(profil?.agenda_couleurs)}
      />

      <ProfilForm profil={profil} />

      <ResetNumerotationCard />
    </div>
  );
}
