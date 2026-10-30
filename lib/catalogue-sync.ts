import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { normaliser } from "@/lib/catalogue-recherche";
import type { Database } from "@/types/database";

type LigneAvecAchat = { designation: string; prix_achat_ttc_unitaire?: number | string | null; type?: string | null };

/**
 * Un prix d'achat saisi sur une ligne de devis ou de facture complète
 * l'article du catalogue qui porte la même désignation et n'en a pas
 * encore : la marge de l'article suivant est juste sans ressaisie. Ne
 * touche jamais à un prix d'achat déjà renseigné. Meilleur effort : un
 * échec n'empêche pas l'enregistrement du document.
 */
export async function completerPrixAchatCatalogue(db: SupabaseClient<Database>, lignes: LigneAvecAchat[]): Promise<number> {
  const avecPa = lignes
    .filter((l) => (l.type ?? "ligne") === "ligne")
    .map((l) => {
      const brut = l.prix_achat_ttc_unitaire;
      const pa = brut === null || brut === undefined || brut === "" ? null : Number(String(brut).replace(",", "."));
      return { cle: normaliser(l.designation ?? ""), pa };
    })
    .filter((l): l is { cle: string; pa: number } => l.cle !== "" && l.pa !== null && Number.isFinite(l.pa) && l.pa > 0);
  if (avecPa.length === 0) return 0;

  const { data: sansPa } = await db.from("produits_services").select("id, designation, description").is("prix_achat_ttc", null);
  if (!sansPa || sansPa.length === 0) return 0;
  let maj = 0;
  for (const p of sansPa) {
    const description = (p.description ?? "").trim();
    const cles = [normaliser(p.designation), description ? normaliser(`${p.designation} — ${description}`) : null];
    const ligne = avecPa.find((l) => cles.includes(l.cle));
    if (!ligne) continue;
    const { error } = await db.from("produits_services").update({ prix_achat_ttc: Math.round(ligne.pa * 100) / 100 }).eq("id", p.id).is("prix_achat_ttc", null);
    if (!error) maj += 1;
  }
  return maj;
}
