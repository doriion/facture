import { describe, expect, it } from "vitest";

import {
  contratsARappeler,
  echeanceVisite,
  type ContratRappelable,
} from "./rappels-entretien";

const TODAY = "2026-09-02";
const OPTS = { today: TODAY, fenetreJours: 30 };

function contrat(over: Partial<ContratRappelable> = {}): ContratRappelable {
  return {
    id: "c1",
    intitule: "Entretien clim annuel",
    equipement: "Clim Daikin",
    statut: "actif",
    date_debut: "2025-09-20",
    frequence: "annuelle",
    prochaine_visite: "2026-09-20", // dans 18 jours
    rappel_envoye_pour: null,
    confirmation_envoyee_pour: null,
    client_email: "client@exemple.fr",
    ...over,
  };
}

describe("contratsARappeler", () => {
  it("retient un contrat actif dont la visite tombe dans la fenêtre", () => {
    const res = contratsARappeler([contrat()], OPTS);
    expect(res).toHaveLength(1);
    expect(res[0]!.joursAvantVisite).toBe(18);
  });

  it("respecte la fenêtre configurable et inclut les bornes", () => {
    // Visite dans 45 j : hors fenêtre de 30, dans une fenêtre de 60
    const lointain = contrat({ prochaine_visite: "2026-10-17" });
    expect(contratsARappeler([lointain], OPTS)).toHaveLength(0);
    expect(
      contratsARappeler([lointain], { today: TODAY, fenetreJours: 60 }),
    ).toHaveLength(1);
    // Bornes : aujourd'hui même et exactement +30 j sont inclus
    expect(
      contratsARappeler(
        [
          contrat({ id: "b1", prochaine_visite: TODAY }),
          contrat({ id: "b2", prochaine_visite: "2026-10-02" }),
        ],
        OPTS,
      ),
    ).toHaveLength(2);
  });

  it("écarte : contrat non actif, visite à convenir déjà proposée, visite passée, sans email", () => {
    expect(
      contratsARappeler(
        [
          contrat({ statut: "suspendu" }),
          contrat({ id: "c2", statut: "resilie" }),
          contrat({ id: "c3", prochaine_visite: null, date_debut: "2020-01-01", rappel_envoye_pour: TODAY }),
          contrat({ id: "c4", prochaine_visite: "2026-08-30" }),
          contrat({ id: "c5", client_email: null }),
        ],
        OPTS,
      ),
    ).toHaveLength(0);
  });

  it("un seul rappel par échéance : rappel_envoye_pour = prochaine_visite → skip", () => {
    const dejaRappele = contrat({ rappel_envoye_pour: "2026-09-20" });
    expect(contratsARappeler([dejaRappele], OPTS)).toHaveLength(0);
    // Rappel envoyé pour une ANCIENNE échéance → nouvelle échéance rappelée
    const nouvelleEcheance = contrat({ rappel_envoye_pour: "2025-09-20" });
    expect(contratsARappeler([nouvelleEcheance], OPTS)).toHaveLength(1);
  });

  it("trie les visites les plus proches en premier", () => {
    const res = contratsARappeler(
      [
        contrat({ id: "loin", prochaine_visite: "2026-09-25" }),
        contrat({ id: "proche", prochaine_visite: "2026-09-05" }),
      ],
      OPTS,
    );
    expect(res.map((c) => c.id)).toEqual(["proche", "loin"]);
  });
});

describe("échéance d'une visite à convenir", () => {
  it("sans prochaine visite : début du contrat + fréquence, jamais avant aujourd'hui", () => {
    expect(echeanceVisite({ prochaine_visite: null, date_debut: "2025-09-20", frequence: "annuelle" }, TODAY)).toBe("2026-09-20");
    expect(echeanceVisite({ prochaine_visite: null, date_debut: "2026-03-01", frequence: "semestrielle" }, TODAY)).toBe(TODAY); // 2026-09-01 < aujourd'hui
    expect(echeanceVisite({ prochaine_visite: "2026-12-01", date_debut: "2025-09-20", frequence: "annuelle" }, TODAY)).toBe("2026-12-01");
  });
  it("contrat mis en service sans date : proposé à l'échéance calculée, une seule fois", () => {
    const res = contratsARappeler([contrat({ prochaine_visite: null, date_debut: "2025-09-20" })], OPTS);
    expect(res).toHaveLength(1);
    expect(res[0]!.echeance).toBe("2026-09-20");
    expect(contratsARappeler([contrat({ prochaine_visite: null, date_debut: "2025-09-20", rappel_envoye_pour: "2026-09-20" })], OPTS)).toHaveLength(0);
  });
  it("visite déjà confirmée au client : rien à proposer", () => {
    expect(contratsARappeler([contrat({ confirmation_envoyee_pour: "2026-09-20" })], OPTS)).toHaveLength(0);
    expect(contratsARappeler([contrat({ confirmation_envoyee_pour: "2026-08-01" })], OPTS)).toHaveLength(1);
  });
});
