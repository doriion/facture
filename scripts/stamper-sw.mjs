#!/usr/bin/env node
/**
 * Estampille la VERSION du service worker (public/sw.js) avec le SHA du
 * commit construit : chaque déploiement change ainsi le contenu de
 * /sw.js, ce qui déclenche « Nouvelle version — Recharger » sur les
 * téléphones et purge les caches du build précédent (sinon la PWA
 * restait sur d'anciens scripts, dont les chunks n'existaient plus).
 *
 * Sans SHA (build local), le fichier n'est pas modifié.
 */
import { readFileSync, writeFileSync } from "node:fs";

const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";
const chemin = new URL("../public/sw.js", import.meta.url);

if (!sha) {
  console.log("sw.js : VERSION inchangée (pas de SHA de build).");
  process.exit(0);
}

const source = readFileSync(chemin, "utf8");
const motif = /^const VERSION = "([^"]+)";/m;
const m = motif.exec(source);
if (!m) {
  console.error("sw.js : ligne `const VERSION = \"…\";` introuvable.");
  process.exit(1);
}
const base = m[1].split("-")[0];
const version = `${base}-${sha.slice(0, 8)}`;
writeFileSync(chemin, source.replace(motif, `const VERSION = "${version}";`));
console.log(`sw.js : VERSION = ${version}`);
