import { describe, expect, it } from "vitest";

import {
  CHATEL_JOURS_CIBLE,
  CHATEL_JOURS_MIN,
  contratsAAviserChatel,
  dateLimiteDenonciation,
  joursEntre,
  type ContratAviseable,
} from "./chatel";

const TODAY = "2026-09-11";

function contrat(over: Partial<ContratAviseable> = {}): ContratAviseable {
  return {
    id: "c-1",
    numero: "2026-001",
    statut: "actif",
    qualite_client: "particulier",
    // J-60 pile
    date_echeance: "2026-11-10",
    rappel_chatel_envoye_pour: null,
    client_email: "client@example.fr",
    client_nom: "Mme Durand",
    ...over,
  };
}

const aviser = (cs: ContratAviseable[]) =>
  contratsAAviserChatel(cs, { today: TODAY });

describe("joursEntre", () => {
  it("compte les jours calendaires en UTC", () => {
    expect(joursEntre("2026-09-11", "2026-11-10")).toBe(60);
    expect(joursEntre("2026-09-11", "2026-09-11")).toBe(0);
    expect(joursEntre("2026-09-11", "2026-09-10")).toBe(-1);
  });

  it("traverse un changement d'heure sans dériver", () => {
    // Passage à l'heure d'hiver en France le 25 octobre 2026
    expect(joursEntre("2026-10-20", "2026-11-05")).toBe(16);
  });

  it("date invalide → NaN", () => {
    expect(Number.isNaN(joursEntre("n'importe quoi", TODAY))).toBe(true);
  });
});

describe("dateLimiteDenonciation (préavis de 2 mois)", () => {
  it("recule de deux mois calendaires", () => {
    expect(dateLimiteDenonciation("2026-11-10")).toBe("2026-09-10");
    expect(dateLimiteDenonciation("2026-03-15")).toBe("2026-01-15");
  });

  it("traverse le changement d'année", () => {
    expect(dateLimiteDenonciation("2027-01-20")).toBe("2026-11-20");
  });

  it("écrête au dernier jour du mois plutôt que de déborder", () => {
    // 30 avril − 2 mois : février n'a pas de 30
    expect(dateLimiteDenonciation("2026-04-30")).toBe("2026-02-28");
    expect(dateLimiteDenonciation("2028-04-30")).toBe("2028-02-29");
    // Cas sans débordement : le quantième est conservé
    expect(dateLimiteDenonciation("2026-12-31")).toBe("2026-10-31");
  });

  it("reste toujours antérieure à l'échéance", () => {
    for (const e of ["2026-01-31", "2026-03-31", "2026-05-31", "2026-12-31"]) {
      expect(dateLimiteDenonciation(e) < e).toBe(true);
    }
  });

  it("date invalide renvoyée telle quelle", () => {
    expect(dateLimiteDenonciation("bidon")).toBe("bidon");
  });
});

describe("contratsAAviserChatel — fenêtre", () => {
  it("avise à la cible (J-60)", () => {
    expect(aviser([contrat()])).toHaveLength(1);
  });

  it("n'avise pas trop tôt (J-61 et au-delà)", () => {
    expect(aviser([contrat({ date_echeance: "2026-11-11" })])).toHaveLength(0);
    expect(aviser([contrat({ date_echeance: "2026-12-11" })])).toHaveLength(0);
  });

  it("rattrape jusqu'à la borne basse (J-32) puis s'arrête", () => {
    // J-32 : dernier jour de rattrapage
    expect(aviser([contrat({ date_echeance: "2026-10-13" })])).toHaveLength(1);
    // J-31 : trop tard, la marge sur la borne légale (J-30) est épuisée
    expect(aviser([contrat({ date_echeance: "2026-10-12" })])).toHaveLength(0);
  });

  it("les bornes restent à l'intérieur des bornes légales (90 / 30 jours)", () => {
    expect(CHATEL_JOURS_CIBLE).toBeLessThan(90);
    expect(CHATEL_JOURS_MIN).toBeGreaterThan(30);
  });

  it("n'avise ni une échéance passée ni une échéance du jour", () => {
    expect(aviser([contrat({ date_echeance: "2026-09-11" })])).toHaveLength(0);
    expect(aviser([contrat({ date_echeance: "2026-08-01" })])).toHaveLength(0);
  });
});

describe("contratsAAviserChatel — éligibilité", () => {
  it("ne vise que les contrats signés ou actifs", () => {
    expect(aviser([contrat({ statut: "signe" })])).toHaveLength(1);
    expect(aviser([contrat({ statut: "actif" })])).toHaveLength(1);
    for (const statut of ["brouillon", "envoye", "resilie", "expire"]) {
      expect(aviser([contrat({ statut })])).toHaveLength(0);
    }
  });

  it("ne vise que le client particulier (la loi Chatel protège le consommateur)", () => {
    expect(aviser([contrat({ qualite_client: "professionnel" })])).toHaveLength(
      0,
    );
  });

  it("exige une échéance et un email client", () => {
    expect(aviser([contrat({ date_echeance: null })])).toHaveLength(0);
    expect(aviser([contrat({ client_email: null })])).toHaveLength(0);
    expect(aviser([contrat({ client_email: "" })])).toHaveLength(0);
  });

  it("n'envoie qu'un seul avis par échéance", () => {
    expect(
      aviser([contrat({ rappel_chatel_envoye_pour: "2026-11-10" })]),
    ).toHaveLength(0);
  });

  it("ré-arme l'avis quand l'échéance a changé (contrat reconduit)", () => {
    expect(
      aviser([contrat({ rappel_chatel_envoye_pour: "2025-11-10" })]),
    ).toHaveLength(1);
  });
});

describe("contratsAAviserChatel — sortie", () => {
  it("trie par échéance la plus proche et expose le nombre de jours", () => {
    const resultat = aviser([
      contrat({ id: "loin", date_echeance: "2026-11-10" }),
      contrat({ id: "proche", date_echeance: "2026-10-15" }),
    ]);
    expect(resultat.map((c) => c.id)).toEqual(["proche", "loin"]);
    expect(resultat[0].joursAvantEcheance).toBe(34);
    expect(resultat[1].joursAvantEcheance).toBe(60);
  });

  it("liste vide → aucun avis", () => {
    expect(aviser([])).toEqual([]);
  });
});
