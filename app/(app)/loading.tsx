/**
 * Squelette de chargement global des pages (app) : affiché par Next.js
 * pendant le rendu serveur d'une navigation. Indispensable sur réseau
 * mobile lent — l'utilisateur voit immédiatement que ça travaille au
 * lieu d'un écran figé. Purement visuel (formes neutres animées).
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement…" className="space-y-6">
      {/* Titre + sous-titre */}
      <div className="space-y-2">
        <div className="h-7 w-44 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-muted" />
      </div>

      {/* Rangée de tuiles (KPI / stats) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border bg-muted/50"
          />
        ))}
      </div>

      {/* Liste (cartes mobiles / lignes de tableau) */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border bg-muted/50 md:h-14"
          />
        ))}
      </div>
    </div>
  );
}
