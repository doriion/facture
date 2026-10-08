/**
 * Badge de la marque : la vague, seule, à côté du nom de l'application
 * écrit en HTML. Utilisé dans la barre latérale, la barre du haut, le
 * menu mobile et l'écran de connexion.
 *
 * L'image est le logo original (public/logo.png, fond transparent,
 * 384 px de large), plus large que haute : la hauteur donne la taille,
 * la largeur suit la proportion de l'image.
 *
 * Le logo est décoratif : le nom l'accompagne toujours en toutes
 * lettres, d'où l'alternative textuelle vide plutôt qu'une description
 * qui serait lue deux fois par un lecteur d'écran.
 *
 * Composant serveur : aucun état, aucun effet.
 */
/** Largeur / hauteur de public/logo.png (384 × 321). */
const PROPORTION = 384 / 321;

export function LogoMarque({ taille = 32 }: { taille?: number }) {
  const largeur = Math.round(taille * PROPORTION);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- image statique, pas d'optimisation utile
    <img
      src="/logo.png"
      alt=""
      width={largeur}
      height={taille}
      className="shrink-0 object-contain"
      style={{ height: taille, width: largeur }}
    />
  );
}
