/** Squelette d'une liste : titre, barre de recherche, cartes (mobile) ou lignes (PC). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement…" className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-56 max-w-full animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="h-11 min-w-[220px] flex-1 animate-pulse rounded-md bg-muted sm:h-10" />
        <div className="h-11 w-40 animate-pulse rounded-md bg-muted sm:h-10" />
        <div className="hidden h-10 w-56 animate-pulse rounded-md bg-muted sm:block" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/50 md:h-14" />
        ))}
      </div>
    </div>
  );
}
