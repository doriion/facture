import { describe, expect, it } from "vitest";

import { cheminVignette, urlsPhotos } from "./photos-vignettes";

describe("cheminVignette", () => {
  it("remplace l'extension par -min.jpg, sans toucher au dossier", () => {
    expect(cheminVignette("u1/i1/1700000000-abc.jpg")).toBe("u1/i1/1700000000-abc-min.jpg");
    expect(cheminVignette("u1/i1/photo.HEIC")).toBe("u1/i1/photo-min.jpg");
    expect(cheminVignette("u1/i.2/sans-extension")).toBe("u1/i.2/sans-extension-min.jpg");
  });
});

describe("urlsPhotos", () => {
  it("associe originale et vignette, null quand la vignette manque", () => {
    const r = urlsPhotos(["a/1.jpg", "a/2.jpg"], [
      { path: "a/1.jpg", signedUrl: "https://x/1" },
      { path: "a/1-min.jpg", signedUrl: "https://x/1m" },
      { path: "a/2.jpg", signedUrl: "https://x/2" },
      { path: "a/2-min.jpg", signedUrl: null },
    ]);
    expect(r.get("a/1.jpg")).toEqual({ url: "https://x/1", urlMin: "https://x/1m" });
    expect(r.get("a/2.jpg")).toEqual({ url: "https://x/2", urlMin: null });
  });
});
