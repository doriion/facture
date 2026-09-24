import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";

import { arreter, BASE, demarrer } from "./serveur";

/**
 * Parcours d'un visiteur NON connecté : ce que l'application montre et
 * refuse sans session. Aucune donnée, aucune base : ces tests tournent
 * en CI sur le build, avec des variables Supabase factices.
 */
let navigateur: Browser;

beforeAll(async () => {
  navigateur = await demarrer();
});

afterAll(async () => {
  await arreter();
});

async function reponse(chemin: string) {
  return fetch(`${BASE}${chemin}`, { redirect: "manual" });
}

describe("connexion", () => {
  it("la page de connexion affiche le formulaire (email, mot de passe)", async () => {
    const page = await navigateur.newPage();
    await page.goto(`${BASE}/login`);
    await page.locator("input#email").waitFor({ state: "visible" });
    expect(await page.locator("input#password").isVisible()).toBe(true);
    expect(await page.getByRole("button", { name: /connecter/i }).isVisible()).toBe(true);
    await page.close();
  });

  it("refuse une saisie vide sans appeler le réseau", async () => {
    const page = await navigateur.newPage();
    const requetes: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("supabase.co")) requetes.push(r.url());
    });
    await page.goto(`${BASE}/login`);
    await page.getByRole("button", { name: /connecter/i }).click();
    // Message de validation Zod côté client (sous le champ)
    await page.getByText(/invalide|minimum|obligatoire/i).first().waitFor({ state: "visible" });
    expect(requetes).toEqual([]);
    await page.close();
  });

  it("tient sur un écran de téléphone sans défilement horizontal", async () => {
    const page = await navigateur.newPage({ viewport: { width: 375, height: 700 } });
    await page.goto(`${BASE}/login`);
    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(deborde).toBe(false);
    await page.close();
  });
});

describe("accès sans session", () => {
  it("la racine et les écrans privés redirigent vers la connexion en gardant la destination", async () => {
    const racine = await reponse("/");
    expect(racine.status).toBe(307);
    expect(racine.headers.get("location")).toMatch(/\/login$/);

    const factures = await reponse("/factures");
    expect(factures.status).toBe(307);
    expect(factures.headers.get("location")).toContain("/login?next=%2Ffactures");
  });

  it("les routes API répondent 401, jamais une page de connexion", async () => {
    const pdf = await reponse("/api/factures/00000000-0000-0000-0000-000000000000/pdf");
    expect(pdf.status).toBe(401);
    const backup = await reponse("/api/exports/backup");
    expect(backup.status).toBe(401);
  });
});

describe("pages publiques", () => {
  it("un lien de signature inconnu affiche « Lien invalide » et interdit l'indexation", async () => {
    const res = await reponse("/c/jeton-inexistant");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-robots-tag")).toMatch(/noindex/);
    const page = await navigateur.newPage();
    await page.goto(`${BASE}/c/jeton-inexistant`);
    await page.locator("h1").first().waitFor({ state: "visible" });
    const titres = (await page.locator("h1").allTextContents()).join(" | ");
    // Sans clé service role (CI), la page annonce le service indisponible ;
    // avec, le lien est refusé. Dans les deux cas : aucun contrat, aucune
    // signature affichée.
    expect(titres).toMatch(/lien invalide|indisponible/i);
    expect(await page.locator("canvas").count()).toBe(0);
    await page.close();
  });

  it("la page hors-ligne est servie sans session", async () => {
    const res = await reponse("/hors-ligne");
    expect(res.status).toBe(200);
  });
});

describe("PWA et robots", () => {
  it("le manifeste est public et nomme l'application", async () => {
    const res = await reponse("/manifest.json");
    expect(res.status).toBe(200);
    const manifest = (await res.json()) as { name?: string; start_url?: string };
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
  });

  it("le service worker est servi en JavaScript", async () => {
    const res = await reponse("/sw.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("robots.txt est lisible sans connexion et interdit tout", async () => {
    const res = await reponse("/robots.txt");
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/Disallow:\s*\//);
  });
});
