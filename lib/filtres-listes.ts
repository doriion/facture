/**
 * Filtres des listes (factures, devis, clients, interventions) — logique
 * PURE, testée dans filtres-listes.test.ts.
 *
 * Les listes sont chargées entières par le serveur ; la recherche et les
 * filtres s'appliquent sur le téléphone, à chaque frappe, sans
 * aller-retour serveur (avant : une navigation complète par lettre
 * tapée, avec squelette gris à chaque fois).
 *
 * Recherche : insensible à la casse et aux accents, sur plusieurs
 * champs dont le nom du client (qui n'était pas cherché avant).
 */

export function normaliserTexte(s: string | null | undefined): string {
  // Décomposition NFD puis retrait des diacritiques (U+0300 → U+036F),
  // sans regex Unicode (cible TypeScript es5).
  return Array.from((s ?? "").toLowerCase().normalize("NFD"))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("");
}

/** Vrai si tous les mots de la recherche apparaissent dans l'un des champs. */
export function contient(
  champs: Array<string | null | undefined>,
  recherche: string,
): boolean {
  const mots = normaliserTexte(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const texte = champs.map(normaliserTexte).join(" | ");
  return mots.every((m) => texte.includes(m));
}

const TOUS = (v: string | undefined) => !v || v === "tous";

export type FiltresDocuments = { search?: string; statut?: string; type?: string };

type DocumentFiltrable = {
  numero: string;
  notes?: string | null;
  statut_affichage: string;
  type_activite: string | null;
  client: { nom: string } | null;
};

/**
 * Factures : statut sur l'AFFICHAGE (« retard » = envoyée en retard),
 * donc « Envoyée » n'inclut pas les retards et « En retard » les liste.
 */
export function filtrerFactures<T extends DocumentFiltrable>(
  factures: T[],
  f: FiltresDocuments,
): T[] {
  return factures.filter(
    (x) =>
      (TOUS(f.statut) || x.statut_affichage === f.statut) &&
      (TOUS(f.type) || x.type_activite === f.type) &&
      contient([x.numero, x.notes, x.client?.nom], f.search ?? ""),
  );
}

/** Devis : « expire » = envoyé dont la validité est dépassée, « envoye » = encore valable. */
export function filtrerDevis<T extends DocumentFiltrable>(devis: T[], f: FiltresDocuments): T[] {
  return devis.filter(
    (x) =>
      (TOUS(f.statut) || x.statut_affichage === f.statut) &&
      (TOUS(f.type) || x.type_activite === f.type) &&
      contient([x.numero, x.notes, x.client?.nom], f.search ?? ""),
  );
}

export type FiltresClients = { search?: string; type?: string };

type ClientFiltrable = {
  nom: string;
  type: string;
  ville?: string | null;
  email?: string | null;
  telephone?: string | null;
  raison_sociale?: string | null;
};

export function filtrerClients<T extends ClientFiltrable>(clients: T[], f: FiltresClients): T[] {
  return clients.filter(
    (c) =>
      (TOUS(f.type) || c.type === f.type) &&
      contient([c.nom, c.ville, c.email, c.telephone, c.raison_sociale], f.search ?? ""),
  );
}

export type FiltresInterventions = { search?: string; type?: string };

type InterventionFiltrable = {
  type: string;
  description: string | null;
  equipement_marque: string | null;
  equipement_modele: string | null;
  equipement_num_serie: string | null;
  client: { nom: string } | null;
};

export function filtrerInterventions<T extends InterventionFiltrable>(
  interventions: T[],
  f: FiltresInterventions,
): T[] {
  return interventions.filter(
    (i) =>
      (TOUS(f.type) || i.type === f.type) &&
      contient(
        [i.description, i.equipement_marque, i.equipement_modele, i.equipement_num_serie, i.client?.nom],
        f.search ?? "",
      ),
  );
}

/** Paramètres d'URL correspondant aux filtres (liens profonds conservés). */
export function parametresFiltres(f: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v && v !== "tous") p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
