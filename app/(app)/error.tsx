"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Erreur de rendu dans une page de l'application : la coque (menu,
 * barre du bas) reste en place, seul le contenu est remplacé — on
 * peut réessayer ou changer d'écran sans recharger toute la PWA.
 * L'erreur est remontée à Sentry (nettoyée par beforeSend).
 */
export default function ErreurPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Chunk introuvable après un déploiement (ancienne page, nouveaux
    // fichiers) : un rechargement suffit, une seule fois.
    const chunkPerdu = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(
      `${error.name} ${error.message}`,
    );
    if (chunkPerdu) {
      let deja = false;
      try {
        deja = sessionStorage.getItem("recharge-chunk") === "1";
        if (!deja) sessionStorage.setItem("recharge-chunk", "1");
      } catch {
        /* stockage indisponible */
      }
      if (!deja) {
        window.location.reload();
        return;
      }
    }
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <AlertTriangle className="size-10 text-amber-500" />
      <h1 className="text-xl font-bold tracking-tight">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="text-sm text-muted-foreground">
        L&apos;incident a été enregistré. Vos données ne sont pas
        touchées : réessayez, ou revenez à l&apos;agenda.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">Référence : {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="size-4" />
          Réessayer
        </Button>
        <Button asChild variant="outline">
          <Link href="/agenda">Aller à l&apos;agenda</Link>
        </Button>
      </div>
    </div>
  );
}
