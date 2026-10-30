import { describe, expect, it } from "vitest";

import { texteRecapMatin } from "./recap-matin";

describe("récapitulatif du matin", () => {
  it("rien à dire → pas de notification", () => {
    expect(texteRecapMatin({ rdv: [], nbAFacturer: 0, nbFacturesEnRetard: 0, nbTachesEnRetard: 0, nbDevisAcceptesAFacturer: 0, nbDevisARelancer: 0 })).toBeNull();
  });
  it("un rendez-vous et des attentes", () => {
    const r = texteRecapMatin({
      rdv: [{ heure: "09:00", libelle: "Entretien PAC · Julien Clément" }],
      nbAFacturer: 4,
      nbFacturesEnRetard: 0,
      nbTachesEnRetard: 1,
      nbDevisAcceptesAFacturer: 3,
      nbDevisARelancer: 2,
    });
    expect(r?.titre).toBe("1 rendez-vous : 09:00 Entretien PAC · Julien Clément");
    expect(r?.corps).toBe("À faire : 4 interventions à facturer, 3 devis acceptés à facturer, 2 devis à relancer, 1 tâche en retard.");
    expect(r?.url).toBe("/dashboard");
  });
  it("plusieurs rendez-vous : trois affichés puis « … »", () => {
    const r = texteRecapMatin({
      rdv: [1, 2, 3, 4].map((i) => ({ heure: null, libelle: `RDV ${i}` })),
      nbAFacturer: 0,
      nbFacturesEnRetard: 0,
      nbTachesEnRetard: 0,
      nbDevisAcceptesAFacturer: 0,
      nbDevisARelancer: 0,
    });
    expect(r?.titre).toBe("4 rendez-vous : RDV 1 · RDV 2 · RDV 3 …");
    expect(r?.corps).toBe("Rien d'autre en attente. Bonne journée !");
  });
});
