/**
 * Barre d'action fixe en bas d'écran sur mobile (zone du pouce).
 *
 * Reçoit le ou les boutons d'action principaux de la page et les rend
 * en pleine largeur, au-dessus du contenu (backdrop translucide).
 * Masquée à partir de md — sur desktop les actions restent en haut de
 * page. Un spacer réserve la hauteur en fin de contenu pour que la
 * barre ne recouvre jamais les derniers éléments, et le padding bas
 * respecte la zone sous la barre iPhone (safe-area-inset-bottom).
 */
export function MobileActionBar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-16 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden [&>*]:min-h-12 [&>*]:flex-1">
        {children}
      </div>
    </>
  );
}
