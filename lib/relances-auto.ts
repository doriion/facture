/**
 * Sélection des factures à relancer AUTOMATIQUEMENT — logique PURE,
 * testée. Le cron n'envoie que ce que cette fonction retient.
 *
 * Règles (toutes cumulatives) :
 *  1. facture « envoyée » (impayée), non exclue des relances auto ;
 *  2. échéance dépassée d'au moins `delaiJours` (défaut 15) ;
 *  3. client avec une adresse email ;
 *  4. AUCUNE relance (manuelle ou auto) dans les `cooldownJours`
 *     derniers jours (défaut 15) — on ne harcèle pas ;
 *  5. moins de `maxAuto` relances automatiques déjà parties (défaut
 *     2) — au-delà, c'est au téléphone de prendre le relais.
 */

import { joursDeRetard } from "@/lib/relances-helpers";

export type FactureRelancable = {
  id: string;
  numero: string;
  statut: string;
  date_echeance: string;
  exclure_relances_auto: boolean;
  client_email: string | null;
};

export type RelanceExistante = {
  facture_id: string;
  /** timestamptz ISO */
  envoyee_le: string;
  automatique: boolean;
};

export type OptionsSelection = {
  today: string;
  delaiJours: number;
  cooldownJours?: number;
  maxAuto?: number;
};

const JOUR_MS = 24 * 3600 * 1000;

export function facturesARelancer(
  factures: FactureRelancable[],
  relances: RelanceExistante[],
  options: OptionsSelection,
): Array<FactureRelancable & { joursRetard: number }> {
  const { today, delaiJours } = options;
  const cooldownJours = options.cooldownJours ?? 15;
  const maxAuto = options.maxAuto ?? 2;
  const limiteCooldown = Date.parse(today) - cooldownJours * JOUR_MS;

  const parFacture = new Map<
    string,
    { nbAuto: number; derniereLe: number }
  >();
  for (const r of relances) {
    const info = parFacture.get(r.facture_id) ?? {
      nbAuto: 0,
      derniereLe: 0,
    };
    if (r.automatique) info.nbAuto += 1;
    info.derniereLe = Math.max(info.derniereLe, Date.parse(r.envoyee_le));
    parFacture.set(r.facture_id, info);
  }

  return factures
    .filter((f) => {
      if (f.statut !== "envoyee") return false;
      if (f.exclure_relances_auto) return false;
      if (!f.client_email) return false;
      const retard = joursDeRetard(f.date_echeance, today);
      if (retard < delaiJours) return false;
      const info = parFacture.get(f.id);
      if (info) {
        if (info.nbAuto >= maxAuto) return false;
        if (info.derniereLe > limiteCooldown) return false;
      }
      return true;
    })
    .map((f) => ({ ...f, joursRetard: joursDeRetard(f.date_echeance, options.today) }));
}
