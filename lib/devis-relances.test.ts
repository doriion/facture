import { describe, expect, it } from "vitest";

import { devisARelancer, joursDepuisContact } from "./devis-relances";

const d = (over: Partial<Parameters<typeof devisARelancer>[0][number]> & { id: string }) => ({
  statut: "envoye",
  est_modele: false,
  date_emission: "2026-10-01",
  date_validite: "2026-11-30",
  email_envoye_le: null as string | null,
  facture_id: null as string | null,
  ...over,
});

describe("devis à relancer", () => {
  const today = "2026-10-30";
  it("envoyé il y a 7 jours ou plus, encore valable, sans facture", () => {
    const r = devisARelancer(
      [
        d({ id: "vieux", email_envoye_le: "2026-10-10T10:00:00Z" }),
        d({ id: "recent", email_envoye_le: "2026-10-28T10:00:00Z" }),
        d({ id: "limite", email_envoye_le: "2026-10-23T23:00:00Z" }),
        d({ id: "expire", date_validite: "2026-10-20" }),
        d({ id: "accepte", statut: "accepte" }),
        d({ id: "modele", est_modele: true }),
        d({ id: "sans-mail" }), // émis le 1er, jamais envoyé par mail : date d'émission
      ],
      today,
    );
    expect(r.map((x) => x.id)).toEqual(["sans-mail", "vieux", "limite"]);
  });
  it("jours depuis le dernier contact", () => {
    expect(joursDepuisContact({ date_emission: "2026-10-01", email_envoye_le: "2026-10-23T08:00:00Z" }, today)).toBe(7);
    expect(joursDepuisContact({ date_emission: "2026-10-01", email_envoye_le: null }, today)).toBe(29);
  });
});
