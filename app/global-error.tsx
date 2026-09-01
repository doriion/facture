"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Gestionnaire d'erreurs de rendu React global (App Router) : remonte
 * l'erreur à Sentry (déjà nettoyée par beforeSend) et affiche un écran
 * de repli minimal.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Une erreur est survenue</h1>
          <p style={{ color: "#666" }}>
            L&apos;incident a été enregistré. Rechargez la page pour
            reprendre.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Recharger
          </button>
        </div>
      </body>
    </html>
  );
}
