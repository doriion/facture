/**
 * Recherche instantanée de client pour le formulaire de devis.
 * Logique PURE, testée dans recherche-clients.test.ts.
 *
 * Volontairement plus large que la recherche du catalogue : on cherche
 * un client de tête, avec ce dont on se souvient — un nom mal
 * orthographié, une ville, un bout de numéro de téléphone.
 */

import { normaliser } from "@/lib/catalogue-recherche";

export type ClientRecherche = {
  id: string;
  nom: string;
  raison_sociale?: string | null;
  ville?: string | null;
  code_postal?: string | null;
  email?: string | null;
  telephone?: string | null;
};

/** Au-delà, la liste se lit moins vite qu'on ne tape une lettre de plus. */
export const MAX_CLIENTS_PROPOSES = 10;

/** Libellé d'une ligne de résultat : nom, puis ce qui distingue. */
export function libelleClient(client: ClientRecherche): string {
  const lieu = [client.code_postal, client.ville].filter(Boolean).join(" ");
  const details = [lieu, client.email].filter(Boolean).join(" · ");
  return details ? `${client.nom} — ${details}` : client.nom;
}

/**
 * Les chiffres d'un texte, pour chercher un téléphone sans se soucier
 * des espaces et des points : « 0612 » doit trouver « 06 12 34 56 78 ».
 */
function chiffres(texte: string): string {
  return (texte ?? "").replace(/\D+/g, "");
}

/**
 * Clients correspondant à la saisie, les plus évidents d'abord.
 *
 * Champ vide → les premiers clients, pas une liste vide : ouvrir le
 * champ doit montrer quelque chose d'utile quand on n'a rien à taper.
 */
export function chercherClients(
  clients: ClientRecherche[],
  saisie: string,
  options?: { limite?: number },
): ClientRecherche[] {
  const limite = options?.limite ?? MAX_CLIENTS_PROPOSES;
  const q = normaliser(saisie ?? "");
  const qChiffres = chiffres(saisie ?? "");

  if (!q && !qChiffres) return clients.slice(0, limite);

  const score = (c: ClientRecherche): number | null => {
    const nom = normaliser(c.nom ?? "");
    const raison = normaliser(c.raison_sociale ?? "");
    const ville = normaliser(c.ville ?? "");
    const email = normaliser(c.email ?? "");
    const cp = (c.code_postal ?? "").toLowerCase();
    const tel = chiffres(c.telephone ?? "");

    // Deux chiffres suffisent à chercher un téléphone ou un code
    // postal ; en dessous, tout numéro correspondrait.
    if (qChiffres.length >= 2) {
      if (tel.includes(qChiffres)) return 1;
      if (cp.startsWith(qChiffres)) return 1;
    }
    if (!q) return null;

    if (nom.startsWith(q)) return 0;
    if (nom.split(" ").some((m) => m.startsWith(q))) return 1;
    if (raison.startsWith(q) || ville.startsWith(q)) return 2;
    if (nom.includes(q) || raison.includes(q) || ville.includes(q)) return 3;
    if (email.includes(q)) return 4;
    return null;
  };

  return clients
    .map((c) => ({ c, s: score(c) }))
    .filter((x): x is { c: ClientRecherche; s: number } => x.s !== null)
    .sort((a, b) => a.s - b.s || a.c.nom.localeCompare(b.c.nom, "fr"))
    .slice(0, limite)
    .map((x) => x.c);
}
