"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfil } from "@/lib/actions/profil";
import { ajouterJours } from "@/lib/agenda-vues";
import { aujourdhuiParis } from "@/lib/dates";
import { disponibilitesJours, type DisponibiliteJour } from "@/lib/creneaux-visite";
import { normaliserHoraires } from "@/lib/horaires-visites";
import { occupationsAgenda } from "@/lib/visites/proposer";

/**
 * Disponibilités de l'artisan jour par jour à partir d'une date
 * (14 jours) : jours travaillés, demi-journées libres ou prises, et ce
 * qui les occupe (interventions, visites planifiées, rendez-vous du
 * téléphone). La visite du contrat en cours de planification est
 * ignorée, pour ne pas se bloquer soi-même.
 */
export async function disponibilitesAction(
  depuis: string,
  contratId?: string | null,
  nbJours = 14,
): Promise<{ ok: true; data: DisponibiliteJour[] } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(depuis)) return { ok: false, error: "Date invalide." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };
  const jours = Math.min(Math.max(nbJours, 1), 31);
  const debut = depuis < aujourdhuiParis() ? aujourdhuiParis() : depuis;
  const fin = ajouterJours(debut, jours - 1);
  const profil = await getProfil();
  const occupations = await occupationsAgenda(supabase, user.id, debut, fin, contratId ?? undefined, profil?.external_calendar_url);
  return {
    ok: true,
    data: disponibilitesJours({ depuis: debut, jours, occupations, horaires: normaliserHoraires(profil?.horaires_visites) }),
  };
}
