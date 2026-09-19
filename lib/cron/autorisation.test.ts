import { describe, expect, it } from "vitest";

import { autorisationCron } from "./autorisation";

const A = "a".repeat(32);
const B = "b".repeat(32);

describe("autorisationCron", () => {
  it("accepte l'un ou l'autre secret, exactement", () => {
    expect(autorisationCron(`Bearer ${A}`, [A, B])).toBe(true);
    expect(autorisationCron(`Bearer ${B}`, [A, B])).toBe(true);
    expect(autorisationCron(`Bearer ${A}x`, [A, B])).toBe(false);
    expect(autorisationCron(A, [A])).toBe(false);
  });

  it("refuse tout sans en-tête ou sans secret configuré", () => {
    expect(autorisationCron(null, [A])).toBe(false);
    expect(autorisationCron(`Bearer ${A}`, [undefined, null])).toBe(false);
    expect(autorisationCron("Bearer ", [""])).toBe(false);
  });

  it("ignore un secret trop court (mal configuré)", () => {
    expect(autorisationCron("Bearer court", ["court"])).toBe(false);
  });
});
