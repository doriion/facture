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
