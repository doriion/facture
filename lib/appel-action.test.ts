import { describe, expect, it } from "vitest";

import { appelerAction, MESSAGE_HORS_LIGNE } from "./appel-action";

describe("appelerAction", () => {
  it("laisse passer un résultat normal", async () => {
    expect(await appelerAction(async () => ({ ok: true, data: 1 }))).toEqual({ ok: true, data: 1 });
    expect(await appelerAction(async () => ({ ok: false, error: "refusé" }))).toEqual({ ok: false, error: "refusé" });
  });

  it("hors ligne : un rejet devient un refus explicite", async () => {
    const r = await appelerAction(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      () => true,
    );
    expect(r).toEqual({ ok: false, error: MESSAGE_HORS_LIGNE });
  });

  it("en ligne, une erreur réseau (Safari « Load failed ») est reconnue", async () => {
    const r = await appelerAction(
      async () => {
        throw new TypeError("Load failed");
      },
      () => false,
    );
    expect(r).toEqual({ ok: false, error: MESSAGE_HORS_LIGNE });
  });

  it("autre erreur : message explicite, jamais de promesse rejetée", async () => {
    const r = await appelerAction(
      async () => {
        throw new Error("boom");
      },
      () => false,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/boom/);
  });
});

// ---------------------------------------------------------------------------
// File d'attente hors ligne
// ---------------------------------------------------------------------------
import { vi } from "vitest";

const ajouterAFile = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("@/lib/file-attente", () => ({ ajouterAFile: (...args: unknown[]) => ajouterAFile(...args) }));

import { appelerOuMettreEnAttente } from "./appel-action";

const entree = { id: "00000000-0000-4000-8000-000000000001", type: "tache_fait" as const, payload: { id: "t1", fait: true } };

describe("appelerOuMettreEnAttente", () => {
  it("en ligne : appelle l'action et renvoie son résultat, sans rien mettre en file", async () => {
    ajouterAFile.mockClear();
    Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
    const r = await appelerOuMettreEnAttente(entree, async () => ({ ok: true, data: 42 }));
    expect(r).toEqual({ ok: true, data: 42 });
    expect(ajouterAFile).not.toHaveBeenCalled();
  });

  it("en ligne, un refus du serveur n'est PAS mis en file (il faut corriger, pas réessayer)", async () => {
    ajouterAFile.mockClear();
    Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
    const r = await appelerOuMettreEnAttente(entree, async () => ({ ok: false, error: "Montant trop élevé" }));
    expect(r).toEqual({ ok: false, error: "Montant trop élevé" });
    expect(ajouterAFile).not.toHaveBeenCalled();
  });

  it("hors ligne : rien n'est appelé, l'entrée est mise en file avec son identifiant", async () => {
    ajouterAFile.mockClear();
    Object.defineProperty(globalThis, "navigator", { value: { onLine: false }, configurable: true });
    const appel = vi.fn(async () => ({ ok: true as const, data: 1 }));
    const r = await appelerOuMettreEnAttente(entree, appel);
    expect(r).toEqual({ ok: true, enAttente: true });
    expect(appel).not.toHaveBeenCalled();
    expect(ajouterAFile).toHaveBeenCalledWith("tache_fait", { id: "t1", fait: true }, entree.id);
  });

  it("réseau coupé pendant l'appel : l'entrée est mise en file", async () => {
    ajouterAFile.mockClear();
    Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
    const r = await appelerOuMettreEnAttente(entree, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(r).toEqual({ ok: true, enAttente: true });
    expect(ajouterAFile).toHaveBeenCalledTimes(1);
  });
});
