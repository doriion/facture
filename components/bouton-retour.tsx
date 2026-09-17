"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * « Retour » dans l'en-tête, sur téléphone, dès qu'on est dans une
 * sous-page (/factures/…, /devis/nouvelle, /parametres/…). L'app
 * installée sur l'écran d'accueil n'a pas le geste de retour du bord
 * de l'écran : ce bouton est toujours au même endroit.
 *
 * Revient à la page précédente s'il y en a une dans l'historique de
 * l'app, sinon à la liste parente (ouverture directe sur une fiche).
 */
export function BoutonRetour() {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const parent = `/${segments[0]}`;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Retour"
      className="-ml-1 md:hidden"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(parent);
      }}
    >
      <ChevronLeft className="size-6" />
    </Button>
  );
}
