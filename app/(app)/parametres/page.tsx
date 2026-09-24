import { AlertTriangle } from "lucide-react";

import { ProfilForm } from "@/components/parametres/profil-form";
import { LogoUpload } from "@/components/parametres/logo-upload";
import { CalendarSyncCard } from "@/components/parametres/calendar-sync-card";
import { AgendaCouleursCard } from "@/components/parametres/agenda-couleurs-card";
import { ExternalCalendarCard } from "@/components/parametres/external-calendar-card";
import { ResetNumerotationCard } from "@/components/parametres/reset-numerotation-card";
import { ExportDonneesCard } from "@/components/parametres/export-donnees-card";
import { TauxCotisationsCard } from "@/components/parametres/taux-cotisations-card";
import { BaremeEntretienCard } from "@/components/parametres/bareme-entretien-card";
import { AutomatisationsCard } from "@/components/parametres/automatisations-card";
import { RappelsPushCard } from "@/components/parametres/rappels-push-card";
import { DoubleAuthentificationCard } from "@/components/parametres/double-authentification-card";
import { etatMfa } from "@/lib/actions/mfa";
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
import { getBaremeEntretien } from "@/lib/actions/bareme-entretien";
import { getJournalTaches } from "@/lib/actions/automatisations";
import { listAppareilsPush } from "@/lib/actions/push";

export const metadata = { title: "Paramètres — NG Gestion" };

/**
 * Page Paramètres : profil entreprise complet de l'auto-entrepreneur.
 * Server Component — fetch direct, hydrate le ProfilForm (client).
 */
export default async function ParametresPage() {
  // Tout en parallèle : six allers-retours en série faisaient
  // attendre la page plusieurs secondes sur réseau mobile.
  const [profil, bareme, baremeEntretien, journal, appareilsPush, mfa] =
    await Promise.all([
      getProfil(),
      getBaremeCotisations(),
      getBaremeEntretien(),
      getJournalTaches(),
      listAppareilsPush(),
      etatMfa(),
    ]);
  const logoUrl = await getLogoUrl(profil?.logo_url);
  const reglagesPush = {
    actif: profil?.auto_rappels_push_active ?? false,
    delai_minutes: profil?.rappels_push_delai_minutes ?? 30,
    clePublique: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  };
  const reglages = {
    auto_sauvegarde_active: profil?.auto_sauvegarde_active ?? true,
    auto_relances_active: profil?.auto_relances_active ?? false,
    relances_delai_jours: profil?.relances_delai_jours ?? 15,
    auto_rappels_active: profil?.auto_rappels_active ?? false,
    rappels_fenetre_jours: profil?.rappels_fenetre_jours ?? 30,
    auto_chatel_active: profil?.auto_chatel_active ?? false,
    auto_email_taches_active: profil?.auto_email_taches_active ?? true,
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

      {!profil?.fluides_valide_jusquau && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-amber-900 dark:text-amber-200">
            <strong>Attestation fluides frigorigènes :</strong> la date
            « valable jusqu'au » n'est pas renseignée. Sans elle, aucune
            alerte d'expiration ne peut vous prévenir avant le renouvellement.
            Renseignez-la dans la section « Climatisation / Pompes à
            chaleur » ci-dessous.
          </p>
        </div>
      )}

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

      <DoubleAuthentificationCard etat={mfa} />

      <CalendarSyncCard initialToken={profil?.calendar_token ?? null} />

      <ExternalCalendarCard
        initialUrl={profil?.external_calendar_url ?? null}
      />

      <AgendaCouleursCard
        initialCouleurs={normalizeCouleurs(profil?.agenda_couleurs)}
      />

      <ProfilForm profil={profil} />

      <RappelsPushCard reglages={reglagesPush} appareils={appareilsPush} />

      <AutomatisationsCard reglages={reglages} journal={journal} />

      <TauxCotisationsCard bareme={bareme} />

      <BaremeEntretienCard nbPostes={baremeEntretien.postes.length} />

      <ExportDonneesCard />

      <ResetNumerotationCard />
    </div>
  );
}
