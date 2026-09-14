/**
 * Génère toutes les icônes de l'application à partir de public/logo.svg.
 *
 *   node scripts/icones.mjs
 *
 * Produit dans public/icones/ :
 *   vague-192.png, vague-512.png     icônes standard du manifeste
 *   vague-maskable-512.png           icône « maskable » (Android découpe
 *                                    l'image ; la vague reste dans la
 *                                    zone sûre centrale de 80 %)
 *   vague-apple-180.png              icône iPhone (iOS ignore la
 *                                    transparence : fond opaque)
 *   vague-32.png                     favicon bitmap
 *   vague.svg                        favicon vectoriel
 * et public/favicon.ico (le PNG 32 px encapsulé : les navigateurs
 * demandent ce chemin d'eux-mêmes, même sans lien dans la page).
 *
 * Les fichiers portent un nom NOUVEAU, différent des anciennes icônes :
 * un téléphone garde l'icône d'accueil en cache tant que son URL ne
 * change pas. Pour changer d'icône un jour, changer le préfixe ci-dessous
 * ET dans manifest.json / app/layout.tsx.
 *
 * Nécessite Playwright (navigateur Chromium) : c'est lui qui rastérise
 * le SVG, il n'y a aucune autre dépendance graphique dans le projet.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

const RACINE = process.cwd();
const SOURCE = join(RACINE, "public", "logo.svg");
const DOSSIER = join(RACINE, "public", "icones");

/** Fond des icônes d'accueil : bleu très pâle (FOND_PALE de lib/theme). */
const FOND = "#F2FAFF";

/** [nom, taille en px, part de la largeur occupée par la vague, fond] */
const ICONES = [
  ["vague-192.png", 192, 0.8, FOND],
  ["vague-512.png", 512, 0.8, FOND],
  // Zone sûre maskable : cercle central de 80 % → la vague tient dans 58 %.
  ["vague-maskable-512.png", 512, 0.58, FOND],
  ["vague-apple-180.png", 180, 0.78, FOND],
  ["vague-32.png", 32, 0.9, FOND],
];

const svg = readFileSync(SOURCE, "utf8");

rmSync(DOSSIER, { recursive: true, force: true });
mkdirSync(DOSSIER, { recursive: true });

const navigateur = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});

for (const [nom, taille, part, fond] of ICONES) {
  const page = await navigateur.newPage({
    viewport: { width: taille, height: taille },
    deviceScaleFactor: 1,
  });
  const cote = Math.round(taille * part);
  await page.setContent(
    `<style>svg{width:100%;height:100%;display:block}</style>
     <body style="margin:0;width:${taille}px;height:${taille}px;background:${fond};display:grid;place-items:center">
       <div style="width:${cote}px;height:${cote}px">${svg}</div>
     </body>`,
  );
  await page.screenshot({ path: join(DOSSIER, nom), omitBackground: false });
  await page.close();
  console.log(`${nom.padEnd(24)} ${taille}×${taille}`);
}
await navigateur.close();

// Favicon vectoriel : la vague sur un carré arrondi pâle, pour rester
// visible dans un onglet quel que soit le thème du navigateur.
const faviconSvg = svg
  .replace(
    /<svg([^>]*)>/,
    `<svg$1><rect width="512" height="512" rx="96" fill="${FOND}"/>`,
  )
  .replace(/<!--[\s\S]*?-->\s*/, "");
writeFileSync(join(DOSSIER, "vague.svg"), faviconSvg);
console.log("vague.svg".padEnd(24), "vectoriel");

// favicon.ico : un conteneur ICO avec le PNG 32 px dedans (format
// accepté par tous les navigateurs modernes).
const png = readFileSync(join(DOSSIER, "vague-32.png"));
const entete = Buffer.alloc(6);
entete.writeUInt16LE(0, 0); // réservé
entete.writeUInt16LE(1, 2); // type : icône
entete.writeUInt16LE(1, 4); // nombre d'images
const entree = Buffer.alloc(16);
entree.writeUInt8(32, 0); // largeur
entree.writeUInt8(32, 1); // hauteur
entree.writeUInt8(0, 2); // palette
entree.writeUInt8(0, 3); // réservé
entree.writeUInt16LE(1, 4); // plans
entree.writeUInt16LE(32, 6); // bits par pixel
entree.writeUInt32LE(png.length, 8); // taille des données
entree.writeUInt32LE(22, 12); // décalage des données
writeFileSync(
  join(RACINE, "public", "favicon.ico"),
  Buffer.concat([entete, entree, png]),
);
console.log("favicon.ico".padEnd(24), "32×32 (PNG encapsulé)");
