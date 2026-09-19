import { describe, expect, it } from "vitest";

import {
  buildEmetteurSnapshot,
  CHAMPS_EMETTEUR_V2,
  profilEffectif,
  VERSION_SNAPSHOT_EMETTEUR,
} from "./emetteur";
import type { Database } from "@/types/database";

type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

const profil = {
  nom: "Geneve",
  prenom: "Nathan",
  nom_commercial: null,
  siret: "12345678901234",
  num_assurance_decennale: "DEC-1",
  assureur_decennale: "ERGO",
  iban: "FR76 0000",
  bic: "BIC1",
  banque_nom: "Banque A",
  escompte_text: "Escompte perso",
  penalites_retard_text: null,
  mediateur_nom: "CM2C",
  decennale_valide_jusquau: "2027-01-01",
} as unknown as Profil;

describe("buildEmetteurSnapshot", () => {
  it("fige les mentions ET le pied de page / RIB (version 2)", () => {
    const s = buildEmetteurSnapshot(profil)!;
    expect(s._version).toBe(VERSION_SNAPSHOT_EMETTEUR);
    expect(s.siret).toBe("12345678901234");
    expect(s.iban).toBe("FR76 0000");
    expect(s.escompte_text).toBe("Escompte perso");
    expect(s.mediateur_nom).toBe("CM2C");
    // Les champs vides ne sont pas stockés
    expect("penalites_retard_text" in s).toBe(false);
  });
});

describe("profilEffectif", () => {
  it("un champ rempli APRÈS l'émission ne fuite pas dans un document émis", () => {
    const snapshot = buildEmetteurSnapshot(profil);
    const profilPlusTard = { ...profil, siret: "99999999999999", iban: "FR76 NOUVEAU" } as Profil;
    const effectif = profilEffectif(profilPlusTard, snapshot)!;
    expect(effectif.siret).toBe("12345678901234");
    expect(effectif.iban).toBe("FR76 0000");
  });

  it("un snapshot ancien (sans version) laisse le RIB et le pied de page au profil courant", () => {
    const ancien = { siret: "12345678901234", nom: "Geneve" };
    const effectif = profilEffectif(profil, ancien)!;
    expect(effectif.siret).toBe("12345678901234");
    // Champs v2 : pas d'autorité de l'ancien snapshot → profil courant
    for (const champ of CHAMPS_EMETTEUR_V2) {
      expect(effectif[champ]).toBe(profil[champ]);
    }
    // Champ v1 absent de l'ancien snapshot : vide à l'émission → null
    expect(effectif.num_assurance_decennale).toBeNull();
  });

  it("sans snapshot (brouillon) : profil courant tel quel", () => {
    expect(profilEffectif(profil, null)).toBe(profil);
  });
});
