import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { EN_TETE_UTILISATEUR, lireUtilisateurTransmis } from "@/lib/auth-transmise";
import { getCompteurBadgeTaches } from "@/lib/actions/taches";
import { BarreOnglets } from "@/components/barre-onglets";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { RestaurationDefilement } from "@/components/restauration-defilement";
import { IndicateurHorsLigne } from "@/components/indicateur-hors-ligne";
import { FileAttentePanneau } from "@/components/file-attente-panneau";
import { RafraichissementPage } from "@/components/rafraichissement-page";

/**
 * Layout pour toutes les routes authentifiées (sous le groupe `(app)`).
 * Garantit côté serveur qu'un utilisateur est connecté ; sinon redirect.
 * (Le middleware — middleware.ts à la racine — fait déjà ce contrôle et
 * rafraîchit la session ; on garde ce double check en défense en
 * profondeur au cas où le matcher serait contourné.)
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Identité validée par le middleware (un seul appel à Supabase Auth
  // par navigation) ; à défaut (matcher contourné), getUser comme avant.
  const transmis = lireUtilisateurTransmis((await headers()).get(EN_TETE_UTILISATEUR));
  const user = transmis
    ? transmis
    : await (await createClient()).auth
        .getUser()
        .then(({ data }) => (data.user ? { id: data.user.id, email: data.user.email ?? "" } : null));

  if (!user) {
    redirect("/login");
  }

  // Badge « À faire » (tâches échues aujourd'hui + en retard) : lu en
  // base, mais SANS retenir le premier octet de la page — la coquille
  // part tout de suite, le badge arrive en flux (Suspense) juste après.
  const badgeTaches = getCompteurBadgeTaches();

  return (
    // h-dvh (hauteur dynamique) : suit la barre d'URL mobile, contrairement
    // à h-screen. Les paddings env(safe-area-inset-*) gardent le contenu
    // hors de l'encoche iPhone (viewport-fit=cover dans app/layout.tsx).
    <div className="flex h-dvh overflow-hidden bg-background pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
      <Suspense fallback={<Sidebar />}>
        <SidebarAvecBadge badge={badgeTaches} />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar email={user.email} />
        <RafraichissementPage />
        <IndicateurHorsLigne />
        <FileAttentePanneau />
        <main className="flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6">
          <Suspense fallback={null}>
            <RestaurationDefilement />
          </Suspense>
          {children}
        </main>
        {/* Téléphone : Agenda · Devis · Factures · Entretiens · Plus */}
        <Suspense fallback={<BarreOnglets />}>
          <BarreOngletsAvecBadge badge={badgeTaches} />
        </Suspense>
      </div>
    </div>
  );
}

async function SidebarAvecBadge({ badge }: { badge: Promise<number> }) {
  return <Sidebar badgeTaches={await badge} />;
}

async function BarreOngletsAvecBadge({ badge }: { badge: Promise<number> }) {
  return <BarreOnglets badgeTaches={await badge} />;
}
