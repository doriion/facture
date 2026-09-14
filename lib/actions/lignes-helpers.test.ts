import { describe, expect, it } from "vitest";

import {
  remplacerLignesDocument,
  type LignePayload,
} from "./lignes-helpers";

const LIGNES: LignePayload[] = [
  {
    ordre: 0,
    designation: "Pose ballon thermodynamique",
    nature_fiscale: "bic_prestations",
    type: "ligne",
    quantite: 1,
    prix_unitaire_ht: 2400,
    prix_achat_ttc_unitaire: 1450,
    fournisseur: "Yukai",
    total_ht: 2400,
  },
];

type Appel = { nom: string; args: unknown };

/**
 * Faux client Supabase : enregistre les appels et renvoie les erreurs
 * programmées. Reproduit les chaînages utilisés par le helper.
 */
function faireClient(options: {
  erreurRpc?: { code?: string; message: string } | null;
  erreurDelete?: { message: string } | null;
  erreurInsert?: { message: string } | null;
}) {
  const appels: Appel[] = [];
  const client = {
    rpc(nom: string, args: unknown) {
      appels.push({ nom: `rpc:${nom}`, args });
      return Promise.resolve({ error: options.erreurRpc ?? null });
    },
    from(table: string) {
      return {
        delete() {
          return {
            eq(colonne: string, valeur: unknown) {
              appels.push({
                nom: `delete:${table}`,
                args: { colonne, valeur },
              });
              return Promise.resolve({ error: options.erreurDelete ?? null });
            },
          };
        },
        insert(rows: unknown) {
          appels.push({ nom: `insert:${table}`, args: rows });
          return Promise.resolve({ error: options.erreurInsert ?? null });
        },
      };
    },
  };
  return { client, appels };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asSupabase = (c: unknown) => c as any;

describe("remplacerLignesDocument", () => {
  it("passe par la RPC transactionnelle et ne touche pas aux tables", async () => {
    const { client, appels } = faireClient({});
    const res = await remplacerLignesDocument(
      asSupabase(client),
      "devis",
      "dev-1",
      "user-1",
      LIGNES,
    );
    expect(res.ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect(appels[0]).toEqual({
      nom: "rpc:remplacer_lignes_document",
      args: {
        p_type: "devis",
        p_document_id: "dev-1",
        p_lignes: LIGNES,
      },
    });
  });

  it("remonte l'erreur métier de la RPC sans rien supprimer", async () => {
    const { client, appels } = faireClient({
      erreurRpc: { code: "42501", message: "Accès refusé" },
    });
    const res = await remplacerLignesDocument(
      asSupabase(client),
      "devis",
      "dev-1",
      "user-1",
      LIGNES,
    );
    expect(res).toEqual({ ok: false, error: "Accès refusé" });
    // Aucun DELETE : un refus d'accès ne doit jamais déclencher le repli
    expect(appels.filter((a) => a.nom.startsWith("delete:"))).toHaveLength(0);
  });

  it("retombe sur DELETE + INSERT tant que la migration n'est pas appliquée", async () => {
    const { client, appels } = faireClient({
      erreurRpc: {
        code: "PGRST202",
        message:
          "Could not find the function public.remplacer_lignes_document",
      },
    });
    const res = await remplacerLignesDocument(
      asSupabase(client),
      "facture",
      "fac-7",
      "user-1",
      LIGNES,
    );
    expect(res.ok).toBe(true);
    expect(appels.map((a) => a.nom)).toEqual([
      "rpc:remplacer_lignes_document",
      "delete:factures_lignes",
      "insert:factures_lignes",
    ]);
    expect(appels[1].args).toEqual({ colonne: "facture_id", valeur: "fac-7" });
    expect(appels[2].args).toEqual([
      { ...LIGNES[0], user_id: "user-1", facture_id: "fac-7" },
    ]);
  });

  it("repli devis : bonne table, bonne colonne, user_id imposé", async () => {
    const { client, appels } = faireClient({
      erreurRpc: { code: "42883", message: "function does not exist" },
    });
    await remplacerLignesDocument(
      asSupabase(client),
      "devis",
      "dev-9",
      "user-2",
      LIGNES,
    );
    expect(appels[1]).toEqual({
      nom: "delete:devis_lignes",
      args: { colonne: "devis_id", valeur: "dev-9" },
    });
    expect(appels[2].args).toEqual([
      { ...LIGNES[0], user_id: "user-2", devis_id: "dev-9" },
    ]);
  });

  it("remonte les erreurs du repli", async () => {
    const absente = {
      code: "PGRST202",
      message: "Could not find the function",
    };
    const surDelete = await remplacerLignesDocument(
      asSupabase(
        faireClient({
          erreurRpc: absente,
          erreurDelete: { message: "delete impossible" },
        }).client,
      ),
      "devis",
      "dev-1",
      "user-1",
      LIGNES,
    );
    expect(surDelete).toEqual({ ok: false, error: "delete impossible" });

    const surInsert = await remplacerLignesDocument(
      asSupabase(
        faireClient({
          erreurRpc: absente,
          erreurInsert: { message: "insert impossible" },
        }).client,
      ),
      "devis",
      "dev-1",
      "user-1",
      LIGNES,
    );
    expect(surInsert).toEqual({ ok: false, error: "insert impossible" });
  });

  it("une liste vide vide bien les lignes (suppression de toutes les lignes)", async () => {
    const { client, appels } = faireClient({});
    const res = await remplacerLignesDocument(
      asSupabase(client),
      "devis",
      "dev-1",
      "user-1",
      [],
    );
    expect(res.ok).toBe(true);
    expect((appels[0].args as { p_lignes: unknown }).p_lignes).toEqual([]);
  });
});
