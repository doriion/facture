#!/usr/bin/env node
/**
 * Restauration d'une sauvegarde JSON (Paramètres → Exporter mes données,
 * ou sauvegarde mensuelle reçue par email) dans un projet Supabase
 * VIERGE dont le schéma a été créé par `supabase/migrations`.
 *
 *   node scripts/restaurer-sauvegarde.mjs \
 *     --fichier sauvegarde-facture-ae-2026-09-01.json \
 *     --url https://xxxx.supabase.co \
 *     --service-role <clé service role du projet cible> \
 *     --utilisateur <uuid du compte cible (Authentication → Users)> \
 *     [--executer]
 *
 * Sans `--executer` : répétition à blanc (lecture du fichier, contrôle
 * du format, plan table par table, vérification que le compte cible est
 * vide) — RIEN n'est écrit. Avec `--executer` : insertion dans l'ordre
 * des dépendances, identifiants conservés, `user_id` remplacé par le
 * compte cible. Les fichiers du Storage (logo, photos, signatures, PDF
 * archivés) ne sont PAS dans la sauvegarde : seuls leurs chemins le sont.
 *
 * Le script REFUSE d'écrire si le compte cible possède déjà des lignes
 * dans l'une des tables : on restaure dans le vide, jamais par-dessus.
 *
 * La logique est exportée pour être testée (lib/restauration.test.ts).
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Ordre d'insertion respectant les clés étrangères (relevé sur la base
 * le 24/09/2026). Le test lib/restauration.test.ts vérifie que cette
 * liste couvre exactement TABLES_SAUVEGARDE.
 */
export const ORDRE_RESTAURATION = [
  // Sans dépendance
  "profil_entreprise",
  "numerotation",
  "taux_cotisations",
  "taches_journal",
  "bareme_entretien_zones",
  "bareme_entretien_postes",
  "bareme_entretien_reglages",
  "agenda_couleurs_evenements",
  "push_abonnements",
  "clients",
  "produits_services",
  // factures ↔ devis se référencent mutuellement, et une facture
  // référence sa facture d'origine : ces colonnes sont posées APRÈS
  // (voir COLONNES_DIFFEREES).
  "factures",
  "devis",
  "factures_lignes",
  "devis_lignes",
  "paiements",
  "relances",
  "facture_external_events",
  "declarations_urssaf",
  "interventions_series",
  "contrats_maintenance",
  "contrats",
  "interventions",
  "intervention_photos",
  "intervention_signatures",
  "intervention_cerfa",
  "intervention_bons",
  "external_events_importes",
  "taches",
  "taches_photos",
];

/** Colonnes insérées à NULL puis renseignées une fois toutes les lignes en place. */
export const COLONNES_DIFFEREES = {
  factures: ["devis_id", "facture_parent_id"],
};

const TAILLE_LOT = 200;

/** Contrôle du format du fichier ; renvoie la liste des anomalies (vide = OK). */
export function verifierSauvegarde(payload) {
  const anomalies = [];
  if (!payload || typeof payload !== "object") return ["Fichier illisible."];
  const meta = payload.meta;
  if (!meta || meta.app !== "facture-ae") anomalies.push("Ce fichier n'est pas une sauvegarde Facture AE (meta.app).");
  if (meta && meta.format_version !== 1) anomalies.push(`Version de format inconnue : ${meta.format_version}.`);
  if (!meta || typeof meta.user_id !== "string") anomalies.push("Identifiant du compte d'origine absent (meta.user_id).");
  const data = payload.data;
  if (!data || typeof data !== "object") {
    anomalies.push("Section data absente.");
    return anomalies;
  }
  for (const table of ORDRE_RESTAURATION) {
    const rows = data[table];
    if (rows === undefined) {
      anomalies.push(`Table ${table} absente de la sauvegarde (export antérieur à sa création ?).`);
      continue;
    }
    if (!Array.isArray(rows)) anomalies.push(`Table ${table} : contenu invalide.`);
    else if (meta?.tables && meta.tables[table] !== undefined && meta.tables[table] !== rows.length) {
      anomalies.push(`Table ${table} : ${rows.length} lignes lues, ${meta.tables[table]} annoncées.`);
    }
  }
  for (const table of Object.keys(data)) {
    if (!ORDRE_RESTAURATION.includes(table)) {
      anomalies.push(`Table ${table} présente dans la sauvegarde mais inconnue du script : mettez le script à jour avant de restaurer.`);
    }
  }
  return anomalies;
}

/** Plan : nombre de lignes par table dans l'ordre d'insertion. */
export function planifierRestauration(payload) {
  return ORDRE_RESTAURATION.map((table) => ({
    table,
    lignes: Array.isArray(payload.data?.[table]) ? payload.data[table].length : 0,
  }));
}

/** Prépare les lignes d'une table : user_id remplacé, colonnes différées mises à NULL. */
export function preparerLignes(table, rows, nouveauUserId) {
  const differees = COLONNES_DIFFEREES[table] ?? [];
  return rows.map((row) => {
    const copie = { ...row, user_id: nouveauUserId };
    for (const col of differees) copie[col] = null;
    return copie;
  });
}

/** Mises à jour différées : { id, colonnes… } pour les lignes qui en ont besoin. */
export function misesAJourDifferees(table, rows) {
  const differees = COLONNES_DIFFEREES[table] ?? [];
  if (differees.length === 0) return [];
  const maj = [];
  for (const row of rows) {
    const valeurs = {};
    let utile = false;
    for (const col of differees) {
      if (row[col] !== null && row[col] !== undefined) {
        valeurs[col] = row[col];
        utile = true;
      }
    }
    if (utile) maj.push({ id: row.id, valeurs });
  }
  return maj;
}

/** Le compte cible a-t-il déjà des lignes ? Renvoie les tables non vides. */
export async function tablesNonVides(client, userId) {
  const occupees = [];
  for (const table of ORDRE_RESTAURATION) {
    const { count, error } = await client
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw new Error(`Lecture ${table} : ${error.message}`);
    if ((count ?? 0) > 0) occupees.push(`${table} (${count})`);
  }
  return occupees;
}

/**
 * Restauration proprement dite. `executer = false` : ne fait que les
 * contrôles et renvoie le plan. Renvoie { plan, inseres, misesAJour }.
 */
export async function restaurer(client, payload, { utilisateur, executer, log = () => {} }) {
  const anomalies = verifierSauvegarde(payload);
  if (anomalies.length > 0) {
    throw new Error(`Sauvegarde refusée :\n- ${anomalies.join("\n- ")}`);
  }
  if (typeof utilisateur !== "string" || !/^[0-9a-f-]{36}$/i.test(utilisateur)) {
    throw new Error("Identifiant du compte cible invalide (uuid attendu).");
  }
  const plan = planifierRestauration(payload);
  const occupees = await tablesNonVides(client, utilisateur);
  if (occupees.length > 0) {
    throw new Error(
      `Le compte cible n'est pas vide : ${occupees.join(", ")}. On restaure dans un compte vide, jamais par-dessus des données.`,
    );
  }
  log(`Compte cible vide — ${plan.reduce((s, p) => s + p.lignes, 0)} lignes à restaurer.`);
  if (!executer) {
    log("Répétition à blanc : rien n'est écrit (ajoutez --executer).");
    return { plan, inseres: 0, misesAJour: 0 };
  }

  let inseres = 0;
  const aMettreAJour = [];
  for (const { table, lignes } of plan) {
    if (lignes === 0) continue;
    const rows = payload.data[table];
    const prepares = preparerLignes(table, rows, utilisateur);
    for (let i = 0; i < prepares.length; i += TAILLE_LOT) {
      const lot = prepares.slice(i, i + TAILLE_LOT);
      const { error } = await client.from(table).insert(lot);
      if (error) throw new Error(`Insertion ${table} (lot ${i / TAILLE_LOT + 1}) : ${error.message}`);
      inseres += lot.length;
    }
    log(`${table} : ${prepares.length} ligne(s)`);
    for (const maj of misesAJourDifferees(table, rows)) aMettreAJour.push({ table, ...maj });
  }

  let misesAJour = 0;
  for (const { table, id, valeurs } of aMettreAJour) {
    const { error } = await client.from(table).update(valeurs).eq("id", id);
    if (error) throw new Error(`Mise à jour différée ${table} ${id} : ${error.message}`);
    misesAJour += 1;
  }
  if (misesAJour > 0) log(`Liens différés posés : ${misesAJour}`);
  return { plan, inseres, misesAJour };
}

function lireArguments(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const cle = a.slice(2);
    if (cle === "executer") args.executer = true;
    else args[cle] = argv[++i];
  }
  return args;
}

async function main() {
  const args = lireArguments(process.argv.slice(2));
  const manquants = ["fichier", "url", "service-role", "utilisateur"].filter((k) => !args[k]);
  if (manquants.length > 0) {
    console.error(`Arguments manquants : ${manquants.map((k) => "--" + k).join(", ")}`);
    console.error("Voir l'en-tête du script ou docs/restauration.md.");
    process.exit(2);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(args.url, args["service-role"], {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const payload = JSON.parse(readFileSync(args.fichier, "utf8"));
  console.log(
    `Sauvegarde du ${payload.meta?.exported_at ?? "?"} (compte d'origine ${payload.meta?.user_id ?? "?"}) → compte ${args.utilisateur}`,
  );
  const resultat = await restaurer(client, payload, {
    utilisateur: args.utilisateur,
    executer: Boolean(args.executer),
    log: (m) => console.log("  " + m),
  });
  for (const p of resultat.plan) if (p.lignes > 0) console.log(`  plan · ${p.table} : ${p.lignes}`);
  if (args.executer) {
    console.log(`Terminé : ${resultat.inseres} lignes insérées, ${resultat.misesAJour} liens différés.`);
    console.log("Pensez aux fichiers du Storage (logo, photos, signatures, PDF) : ils ne sont pas dans la sauvegarde.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
