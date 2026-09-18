/**
 * Enveloppe remontée à chaque navigation : le contenu de la page
 * apparaît en fondu (200 ms) au lieu de « sauter » à l'écran. Animation
 * d'OPACITÉ SEULE (page-fondu, app/globals.css) : la classe animate-in
 * de tailwindcss-animate pose un transform, qui ferait des boutons
 * flottants (fixed) des enfants de la page pendant 200 ms — ils
 * sautaient hors de l'écran à chaque navigation.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-fondu motion-reduce:animate-none">
      {children}
    </div>
  );
}
