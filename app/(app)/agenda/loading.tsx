/** Squelette de l'agenda : mêmes blocs que la vraie page (barre, bandeau des jours, grille). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement de l'agenda…" className="space-y-3 sm:space-y-6">
      <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
      <div className="hidden grid-cols-2 gap-3 sm:grid md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/50" />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="size-9 animate-pulse rounded-md bg-muted" />
        <div className="size-9 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        <div className="ml-auto h-6 w-40 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-16 animate-pulse rounded-lg border bg-muted/50" />
      <div className="h-[28rem] animate-pulse rounded-lg border bg-muted/40" />
    </div>
  );
}
