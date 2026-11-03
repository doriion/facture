import { aujourdhuiParis } from "@/lib/dates";
import { TuilesAccueil } from "@/components/accueil/tuiles-accueil";

export const metadata = { title: "Accueil — NG Gestion" };

/**
 * Accueil du téléphone : de grandes tuiles vers les écrans et les
 * actions choisis par l'utilisateur (mémorisés sur l'appareil). Aucune
 * lecture en base : la page est légère, mise en cache par le service
 * worker et s'affiche instantanément à l'ouverture de l'app.
 */
export default function AccueilPage() {
  return <TuilesAccueil dateDuJour={aujourdhuiParis()} />;
}
