/**
 * Constantes pures liées aux paiements (modes, libellés, types).
 * Sorties du fichier "use server" (lib/actions/paiements.ts) car
 * Next.js interdit l'export d'objets non-async depuis un fichier
 * "use server".
 */

export const MODES_PAIEMENT = [
  "virement",
  "cheque",
  "especes",
  "carte",
  "lien_paiement",
  "autre",
] as const;

export type ModePaiement = (typeof MODES_PAIEMENT)[number];

export const LABELS_MODE_PAIEMENT: Record<ModePaiement, string> = {
  virement: "Virement",
  cheque: "Chèque",
  especes: "Espèces",
  carte: "Carte bancaire",
  lien_paiement: "Lien de paiement",
  autre: "Autre",
};

export type Paiement = {
  id: string;
  facture_id: string;
  date_paiement: string;
  montant: number;
  mode: string;
  reference: string | null;
  notes: string | null;
};

export type FacturePaiementsSummary = {
  total_facture: number;
  total_encaisse: number;
  reste_du: number;
  paiements: Paiement[];
};
