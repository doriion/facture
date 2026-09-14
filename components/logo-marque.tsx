/**
 * Badge de la marque : la vague, seule, à côté du nom de l'application
 * écrit en HTML. Utilisé dans la barre latérale, la barre du haut et
 * le menu mobile — trois endroits qui portaient chacun leur propre
 * carré de lettres recopié.
 *
 * Le fichier est dans le dépôt (public/logo.svg), il n'y a donc plus
 * de repli à prévoir : l'ancien mécanisme de préchargement avec
 * monogramme de secours servait quand l'image n'existait pas encore.
 *
 * Le logo est décoratif : le nom l'accompagne toujours en toutes
 * lettres, d'où l'alternative textuelle vide plutôt qu'une description
 * qui serait lue deux fois par un lecteur d'écran.
 *
 * Composant serveur : aucun état, aucun effet.
 */
export function LogoMarque({ taille = 32 }: { taille?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG statique, pas d'optimisation utile
    <img
      src="/logo.svg"
      alt=""
      width={taille}
      height={taille}
      className="shrink-0 object-contain"
      style={{ height: taille, width: taille }}
    />
  );
}
