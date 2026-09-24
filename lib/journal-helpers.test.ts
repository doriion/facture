import { describe, expect, it } from "vitest";

import { automatismesEnPanne, joursSansExecution } from "./journal-helpers";

describe("joursSansExecution", () => {
  it("compte depuis la dernière ligne, 999 sans journal", () => {
    expect(joursSansExecution([], "2026-09-25")).toBe(999);
    expect(
      joursSansExecution([{ date_execution: "2026-09-20" }, { date_execution: "2026-09-24" }], "2026-09-25"),
    ).toBe(1);
    expect(joursSansExecution([{ date_execution: "2026-09-25" }], "2026-09-25")).toBe(0);
  });
});

describe("automatismesEnPanne", () => {
  it("alerte à partir de deux jours, dit si rien n'a jamais tourné", () => {
    expect(automatismesEnPanne([{ date_execution: "2026-09-24" }], "2026-09-25")).toBeNull();
    expect(automatismesEnPanne([{ date_execution: "2026-09-23" }], "2026-09-25")).toEqual({ jours: 2, jamais: false });
    expect(automatismesEnPanne([], "2026-09-25")).toEqual({ jours: 999, jamais: true });
  });
});
