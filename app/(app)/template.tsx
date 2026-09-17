/**
 * Enveloppe remontée à chaque navigation : le contenu de la page
 * apparaît en fondu (200 ms) au lieu de « sauter » à l'écran. Opacité
 * seule, pas de translation : les boutons flottants ne bougent pas.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in duration-200 motion-reduce:animate-none">
      {children}
    </div>
  );
}
