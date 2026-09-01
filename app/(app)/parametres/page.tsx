import { ProfilForm } from "@/components/parametres/profil-form";
import { LogoUpload } from "@/components/parametres/logo-upload";
import { CalendarSyncCard } from "@/components/parametres/calendar-sync-card";
import { AgendaCouleursCard } from "@/components/parametres/agenda-couleurs-card";
import { ExternalCalendarCard } from "@/components/parametres/external-calendar-card";
import { ResetNumerotationCard } from "@/components/parametres/reset-numerotation-card";
import { ExportDonneesCard } from "@/components/parametres/export-donnees-card";
import { TauxCotisationsCard } from "@/components/parametres/taux-cotisations-card";
import { AutomatisationsCard } from "@/components/parametres/automatisations-card";
import { normalizeCouleurs } from "@/lib/agenda-colors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLogoUrl, getProfil } from "@/lib/actions/profil";
import { getBaremeCotisations } from "@/lib/actions/cotisations";
import { getJournalTaches } from "@/lib/actions/automatisations";

export const metadata = { title: "Paramètres — Facture AE" };

/**
 * Page Paramètres : profil entreprise complet de l'auto-entrepreneur.
 * Server Component — fetch direct, hydrate le ProfilForm (client).
 */
export default async function ParametresPage() {
  const profil = await getProfil();
  const logoUrl = await getLogoUrl(profil?.logo_url);
  const bareme = await getBaremeCotisations();
  const journal = await getJournalTaches();
  const reglages = {
    auto_sauvegarde_active: profil?.auto_sauvegarde_active ?? true,
    auto_relances_active: profil?.auto_relances_active ?? false,
    relances_delai_jours: profil?.relances_delai_jours ?? 15,
    auto_rappels_active: profil?.auto_rappels_active ?? false,
    rappels_fenetre_jours: profil?.rappels_fenetre_jours ?? 30,
    automatisations_simulation: profil?.automatisations_simulation ?? true,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Paramètres</h1>
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

      <ExternalCalendarCard
        initialUrl={profil?.external_calendar_url ?? null}
      />

      <AgendaCouleursCard
        initialCouleurs={normalizeCouleurs(profil?.agenda_couleurs)}
      />

      <ProfilForm profil={profil} />

      <AutomatisationsCard reglages={reglages} journal={journal} />

      <TauxCotisationsCard bareme={bareme} />

      <ExportDonneesCard />

      <ResetNumerotationCard />
    </div>
  );
}
