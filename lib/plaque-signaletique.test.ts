import { describe, expect, it } from "vitest";

import { lirePlaque } from "./plaque-signaletique";

describe("lirePlaque", () => {
  it("plaque de clim : marque, modèle, série, fluide, charge", () => {
    const r = lirePlaque(`DAIKIN INDUSTRIES
MODEL RXM35R5V1B
SERIAL No. E003456
REFRIGERANT R-32  0.76 kg
220-240V 50Hz`);
    expect(r).toMatchObject({ marque: "Daikin", modele: "RXM35R5V1B", numSerie: "E003456", fluide: "R32", chargeKg: 0.76 });
  });

  it("plaque de chaudière en français, étiquettes avec deux-points", () => {
    const r = lirePlaque(`Saunier Duval
Type : ThemaPlus Condens F25
N° de série : 21123400100234567
Gaz naturel G20`);
    expect(r.marque).toBe("Saunier Duval");
    expect(r.modele).toBe("ThemaPlus Condens F25");
    expect(r.numSerie).toBe("21123400100234567");
    expect(r.fluide).toBeNull();
  });

  it("marque composée reconnue avant la marque simple", () => {
    expect(lirePlaque("MITSUBISHI ELECTRIC MSZ-AP25VG").marque).toBe("Mitsubishi Electric");
  });

  it("sans étiquette : jetons alphanumériques comme modèle puis série", () => {
    const r = lirePlaque("ATLANTIC\nALFEA EXTENSA DUO AI 6\nREF 522456 SN 2B1234567");
    expect(r.marque).toBe("Atlantic");
    expect(r.modele).toBe("522456");
    expect(r.numSerie).toBe("2B1234567");
  });

  it("rien de lisible → champs nuls, texte conservé", () => {
    expect(lirePlaque("hello world")).toMatchObject({ marque: null, modele: null, numSerie: null, fluide: null, chargeKg: null });
  });
});
