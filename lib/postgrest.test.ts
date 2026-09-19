import { describe, expect, it } from "vitest";

import { motifIlike } from "./postgrest";

describe("motifIlike", () => {
  it("entoure de jokers et garde le texte", () => {
    expect(motifIlike("chaudière")).toBe("%chaudière%");
  });
  it("neutralise ce qui casserait le filtre PostgREST", () => {
    expect(motifIlike("a,b)c(d")).toBe("%a b c d%");
    expect(motifIlike("100%_x")).toBe("%100 x%");
  });
});
