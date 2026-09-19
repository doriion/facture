/**
 * Barre d'action fixe en bas d'écran sur mobile (zone du pouce).
 *
 * Reçoit le ou les boutons d'action principaux de la page et les rend
 * en pleine largeur, au-dessus du contenu (backdrop translucide).
 * Masquée à partir de md — sur desktop les actions restent en haut de
 * page. Un spacer réserve la hauteur en fin de contenu pour que la
 * barre ne recouvre jamais les derniers éléments. Elle se pose juste
 * au-dessus de la barre d'onglets (3,5 rem + zone sous la barre iPhone).
 */
export function MobileActionBar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-20 md:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden [&>*]:min-h-12 [&>*]:flex-1">
        {children}
      </div>
    </>
  );
}
