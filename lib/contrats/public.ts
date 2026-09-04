import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { etatLienPublic, type EtatLienPublic } from "@/lib/contrats/logic";
import {
  prestataireEffectif,
  type PrestataireSnapshot,
} from "@/lib/contrats/rendu";
import type { Database } from "@/types/database";

type ContratRow = Database["public"]["Tables"]["contrats"]["Row"];

/**
 * Résolution d'un contrat par son access_token — CÔTÉ SERVEUR
 * UNIQUEMENT (service role : contourne la RLS, jamais exposé au
 * navigateur). Le token est opaque, unique, à durée de vie limitée ;
 * une garde de longueur évite les scans triviaux.
 */
export async function getContratParToken(token: string): Promise<{
  etat: EtatLienPublic;
  contrat: ContratRow | null;
  prestataire: PrestataireSnapshot;
}> {
  if (!token || token.length < 16) {
    return { etat: "introuvable", contrat: null, prestataire: {} };
  }

  const service = createServiceClient();
  const { data } = await service
    .from("contrats")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();

  const contrat = (data as ContratRow | null) ?? null;
  const etat = etatLienPublic(contrat, new Date().toISOString());

  // Le prestataire vient du snapshot figé à l'envoi ; filet de sécurité
  // sur le profil courant si un contrat envoyé n'en avait pas.
  let prestataire: PrestataireSnapshot = {};
  if (contrat) {
    if (contrat.prestataire && typeof contrat.prestataire === "object") {
      prestataire = prestataireEffectif(null, contrat.prestataire);
    } else {
      const { data: profil } = await service
        .from("profil_entreprise")
        .select("*")
        .eq("user_id", contrat.user_id)
        .maybeSingle();
      prestataire = prestataireEffectif(profil ?? null, null);
    }
  }

  return { etat, contrat, prestataire };
}
