import { describe, expect, it } from "vitest";

import { propositionsARelancer, propositionsSansReponse, visitesDemain } from "./visites-suivi";

const TODAY = "2026-10-21";
const NOW = "2026-10-21T06:00:00.000Z";

function prop(over: Partial<Parameters<typeof propositionsARelancer>[0][number]> = {}) {
  return {
    id: "p1",
    statut: "envoyee",
    envoyee_le: "2026-10-10T08:00:00.000Z", // 11 jours
    expire_le: "2026-11-09T08:00:00.000Z",
    date_proposee: "2026-11-03",
    relance_le: null,
    artisan_prevenu_le: null,
    ...over,
  };
}

describe("propositionsARelancer", () => {
  it("sans réponse depuis 7 jours, lien encore utilisable, une seule fois", () => {
    expect(propositionsARelancer([prop()], { today: TODAY, nowIso: NOW })).toHaveLength(1);
    expect(propositionsARelancer([prop({ envoyee_le: "2026-10-16T08:00:00.000Z" })], { today: TODAY, nowIso: NOW })).toHaveLength(0); // 5 jours
    expect(propositionsARelancer([prop({ relance_le: "2026-10-18T08:00:00.000Z" })], { today: TODAY, nowIso: NOW })).toHaveLength(0);
    expect(propositionsARelancer([prop({ statut: "confirmee" })], { today: TODAY, nowIso: NOW })).toHaveLength(0);
    expect(propositionsARelancer([prop({ date_proposee: "2026-10-20" })], { today: TODAY, nowIso: NOW })).toHaveLength(0); // date passée
    expect(propositionsARelancer([prop({ expire_le: "2026-10-20T00:00:00.000Z" })], { today: TODAY, nowIso: NOW })).toHaveLength(0);
  });
  it("délai configurable, borne incluse", () => {
    expect(propositionsARelancer([prop({ envoyee_le: "2026-10-14T23:00:00.000Z" })], { today: TODAY, nowIso: NOW, delaiRelanceJours: 7 })).toHaveLength(1);
    expect(propositionsARelancer([prop({ envoyee_le: "2026-10-15T00:00:00.000Z" })], { today: TODAY, nowIso: NOW, delaiRelanceJours: 7 })).toHaveLength(0);
  });
});

describe("propositionsSansReponse", () => {
  it("après 14 jours, même si le lien a expiré, une seule alerte", () => {
    expect(propositionsSansReponse([prop({ envoyee_le: "2026-10-07T08:00:00.000Z" })], { today: TODAY, nowIso: NOW })).toHaveLength(1);
    expect(propositionsSansReponse([prop({ envoyee_le: "2026-10-07T08:00:00.000Z", expire_le: "2026-10-10T00:00:00.000Z" })], { today: TODAY, nowIso: NOW })).toHaveLength(1);
    expect(propositionsSansReponse([prop()], { today: TODAY, nowIso: NOW })).toHaveLength(0); // 11 jours
    expect(propositionsSansReponse([prop({ envoyee_le: "2026-10-01T08:00:00.000Z", artisan_prevenu_le: NOW })], { today: TODAY, nowIso: NOW })).toHaveLength(0);
    expect(propositionsSansReponse([prop({ envoyee_le: "2026-10-01T08:00:00.000Z", statut: "refusee" })], { today: TODAY, nowIso: NOW })).toHaveLength(0);
  });
});

describe("visitesDemain", () => {
  const base = { id: "c1", statut: "actif", prochaine_visite: "2026-10-22", confirmation_envoyee_pour: "2026-10-22", rappel_veille_envoye_pour: null, client_email: "c@ex.fr" };
  it("visite confirmée demain, client joignable, pas encore rappelée", () => {
    expect(visitesDemain([base], TODAY)).toHaveLength(1);
    expect(visitesDemain([{ ...base, prochaine_visite: "2026-10-23", confirmation_envoyee_pour: "2026-10-23" }], TODAY)).toHaveLength(0);
    expect(visitesDemain([{ ...base, confirmation_envoyee_pour: "2026-10-15" }], TODAY)).toHaveLength(0); // non confirmée
    expect(visitesDemain([{ ...base, rappel_veille_envoye_pour: "2026-10-22" }], TODAY)).toHaveLength(0);
    expect(visitesDemain([{ ...base, client_email: null }], TODAY)).toHaveLength(0);
    expect(visitesDemain([{ ...base, statut: "suspendu" }], TODAY)).toHaveLength(0);
  });
});
