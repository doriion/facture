import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/sw-register";

import "./globals.css";
import { PRINCIPAL } from "@/lib/theme";
import { scriptAppliquerTheme } from "@/lib/theme-mode";
import { NOM_APPLICATION } from "@/lib/marque";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: NOM_APPLICATION,
  description: "Gestion factures et devis — auto-entrepreneur BTP",
  manifest: "/manifest.json",
  applicationName: NOM_APPLICATION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: NOM_APPLICATION,
    startupImage: "/icones/vague-apple-180.png",
  },
  // Icônes sous un NOUVEAU chemin : un téléphone garde l'icône d'accueil
  // en cache tant que son URL ne change pas — renommer est le seul moyen
  // sûr de chasser l'ancienne. Générées par scripts/icones.mjs.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icones/vague.svg", type: "image/svg+xml" },
      { url: "/icones/vague-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icones/vague-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icones/vague-apple-180.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: PRINCIPAL,
  // Nécessaire pour que env(safe-area-inset-*) soit renseigné en PWA
  // iPhone (encoche / barre home) — les paddings correspondants sont
  // appliqués dans le layout (app) et les barres fixes.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning : le script ci-dessous modifie la
    // classe de <html> avant que React n'arrive, l'écart avec le HTML
    // du serveur est donc attendu.
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Applique le thème AVANT le premier affichage. Sans ce
            script, la page s'afficherait en clair puis basculerait en
            sombre — un éclair blanc, précisément ce qu'on évite quand
            on travaille le soir. */}
        <script
          dangerouslySetInnerHTML={{ __html: scriptAppliquerTheme() }}
        />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
