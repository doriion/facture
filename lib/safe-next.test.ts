import { describe, expect, it } from "vitest";

import { sanitizeNextPath } from "./safe-next";

describe("sanitizeNextPath", () => {
  it("accepte un chemin interne valide", () => {
    expect(sanitizeNextPath("/factures")).toBe("/factures");
    expect(sanitizeNextPath("/factures/abc-123")).toBe("/factures/abc-123");
    expect(sanitizeNextPath("/agenda?year=2026&month=7")).toBe(
      "/agenda?year=2026&month=7",
    );
    expect(sanitizeNextPath("/")).toBe("/");
  });

  it("rejette les URL externes et protocol-relative", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe("/dashboard");
    expect(sanitizeNextPath("http://evil.com/factures")).toBe("/dashboard");
    expect(sanitizeNextPath("//evil.com")).toBe("/dashboard");
    expect(sanitizeNextPath("//evil.com/factures")).toBe("/dashboard");
  });

  it("rejette les contournements par backslash et caractères de contrôle", () => {
    expect(sanitizeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(sanitizeNextPath("/factures\\..")).toBe("/dashboard");
    expect(sanitizeNextPath("/factures\nSet-Cookie: x")).toBe("/dashboard");
  });

  it("rejette les valeurs vides ou non-string", () => {
    expect(sanitizeNextPath("")).toBe("/dashboard");
    expect(sanitizeNextPath(null)).toBe("/dashboard");
    expect(sanitizeNextPath(undefined)).toBe("/dashboard");
    expect(sanitizeNextPath(42)).toBe("/dashboard");
    expect(sanitizeNextPath("factures")).toBe("/dashboard");
  });

  it("évite les boucles vers /login", () => {
    expect(sanitizeNextPath("/login")).toBe("/dashboard");
    expect(sanitizeNextPath("/login/")).toBe("/dashboard");
    expect(sanitizeNextPath("/login?next=/factures")).toBe("/dashboard");
    // Mais un chemin qui commence par "login" sans en être un reste valide
    expect(sanitizeNextPath("/logineries")).toBe("/logineries");
  });
});
