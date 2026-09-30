import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { construireZip, crc32, lireZip } from "./zip-store";

describe("crc32", () => {
  it("valeurs de référence", () => {
    expect(crc32(new TextEncoder().encode(""))).toBe(0);
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("construireZip / lireZip", () => {
  it("aller-retour avec noms accentués et contenu binaire", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255]);
    const zip = construireZip([
      { nom: "fichiers/pdfs/contrat-signé.pdf", contenu: new TextEncoder().encode("%PDF-1.4 été") },
      { nom: "fichiers/signatures/a/b.png", contenu: png, date: new Date("2026-09-30T10:20:30Z") },
      { nom: "vide.txt", contenu: new Uint8Array(0) },
    ]);
    const lu = lireZip(zip);
    expect(lu.map((e) => e.nom)).toEqual([
      "fichiers/pdfs/contrat-signé.pdf",
      "fichiers/signatures/a/b.png",
      "vide.txt",
    ]);
    expect(new TextDecoder().decode(lu[0]!.contenu)).toBe("%PDF-1.4 été");
    expect(Array.from(lu[1]!.contenu)).toEqual(Array.from(png));
    expect(lu[2]!.contenu.length).toBe(0);
  });

  it("refuse un nom en double", () => {
    expect(() =>
      construireZip([
        { nom: "a.txt", contenu: new Uint8Array(1) },
        { nom: "/a.txt", contenu: new Uint8Array(1) },
      ]),
    ).toThrow(/double/);
  });

  it("est lisible par l'outil unzip du système (si présent)", () => {
    const dossier = mkdtempSync(join(tmpdir(), "zip-store-"));
    const chemin = join(dossier, "t.zip");
    writeFileSync(
      chemin,
      construireZip([{ nom: "dossier/bonjour.txt", contenu: new TextEncoder().encode("bonjour\n") }]),
    );
    let sortie: string;
    try {
      sortie = execFileSync("unzip", ["-t", chemin], { encoding: "utf8" });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ENOENT") return; // unzip absent : test ignoré
      throw e;
    }
    expect(sortie).toMatch(/No errors detected/);
  });
});
