import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { etatLienFiche, libelleEquipement, libelleReserves, type EtatLienFiche } from "@/lib/fiches-gaz";
import { chargerFiche, type FicheChargee } from "@/lib/fiches-gaz/documents";
import { nomExpediteur } from "@/lib/visites/proposer";

export type FichePublique = {
  etat: EtatLienFiche | "indisponible";
  fiche: FicheChargee | null;
  prestataireNom: string;
  equipementText: string | null;
  reservesText: string;
  detenteur: { nom: string; signe_le: string } | null;
};

/**
 * Résolution d'une fiche gaz par son jeton de signature — CÔTÉ SERVEUR
 * UNIQUEMENT (service role, RLS fermée à anon). Le client ne voit que
 * la fiche et ses documents : aucun prix, aucune autre donnée.
 */
export async function getFicheParToken(token: string): Promise<FichePublique> {
  const vide: FichePublique = { etat: "introuvable", fiche: null, prestataireNom: "Votre artisan", equipementText: null, reservesText: "", detenteur: null };
  if (!token || token.length < 16) return vide;
  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch (e) {
    console.error("Lien public fiche gaz — service indisponible :", e);
    return { ...vide, etat: "indisponible" };
  }
  const { data: it } = await service.from("interventions").select("id").eq("signature_token", token).eq("est_fiche_gaz", true).maybeSingle();
  if (!it) return vide;
  const fiche = await chargerFiche(service, it.id);
  if (!fiche) return vide;
  const { data: sigs } = await service
    .from("intervention_signatures")
    .select("signataire_nom, signe_le")
    .eq("intervention_id", it.id)
    .eq("role", "detenteur")
    .order("signe_le", { ascending: false })
    .limit(1);
  const detenteur = sigs?.[0] ? { nom: sigs[0].signataire_nom, signe_le: sigs[0].signe_le } : null;
  const etat = etatLienFiche(fiche.intervention, detenteur !== null, new Date().toISOString());
  return {
    etat,
    fiche,
    prestataireNom: nomExpediteur(fiche.profil),
    equipementText: libelleEquipement(fiche.intervention),
    reservesText: libelleReserves(fiche.intervention.bon_reserves, fiche.intervention.bon_reserves_texte),
    detenteur,
  };
}
