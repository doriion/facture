"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getProfil } from "@/lib/actions/profil";
import { aujourdhuiParis } from "@/lib/dates";
import { creneauPropose } from "@/lib/creneaux-visite";
import { envoyerPropositionVisite } from "@/lib/visites/proposer";
import { baseUrlPublique } from "@/lib/url-publique";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const propositionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date de visite."),
  heure: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide.")
    .optional()
    .or(z.literal("")),
});

/**
 * Propose un créneau de visite au client par e-mail (avec d'autres
 * créneaux libres de l'agenda au choix). Sa réponse, depuis le lien
 * reçu, crée le rendez-vous dans l'agenda.
 */
export async function proposerVisiteAction(
  contratId: string,
  input: { date: string; heure?: string },
): Promise<ActionResult<{ clientEmail: string; nbAutres: number }>> {
  const parsed = propositionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const profil = await getProfil();
  const res = await envoyerPropositionVisite({
    db: supabase,
    userId: user.id,
    contratId,
    profil,
    propose: creneauPropose(parsed.data.date, parsed.data.heure || null),
    origine: "manuel",
    baseUrl: await baseUrlPublique(),
    today: aujourdhuiParis(),
  });
  if (!res.ok) return res;

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${contratId}`);
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  return { ok: true, data: { clientEmail: res.data.clientEmail, nbAutres: res.data.autres.length } };
}

/** Retire une proposition en attente : le lien reçu par le client ne fonctionne plus. */
export async function annulerPropositionAction(propositionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visites_propositions")
    .update({ statut: "annulee" })
    .eq("id", propositionId)
    .eq("statut", "envoyee")
    .select("contrat_id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Proposition introuvable ou déjà traitée." };
  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${data[0]!.contrat_id}`);
  return { ok: true, data: undefined };
}

export type PropositionResume = {
  id: string;
  statut: string;
  origine: string;
  date_proposee: string;
  heure_proposee: string | null;
  envoyee_le: string;
  repondu_le: string | null;
  message_client: string | null;
  choix_date: string | null;
  choix_debut: string | null;
  choix_fin: string | null;
};

/** Dernière proposition envoyée pour chaque contrat demandé (clé : contrat_id). */
export async function dernieresPropositions(contratIds: string[]): Promise<Record<string, PropositionResume>> {
  if (contratIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("visites_propositions")
    .select("id, contrat_id, statut, origine, date_proposee, heure_proposee, envoyee_le, repondu_le, message_client, choix_date, choix_debut, choix_fin")
    .in("contrat_id", contratIds)
    .order("envoyee_le", { ascending: false });
  const parContrat: Record<string, PropositionResume> = {};
  for (const p of data ?? []) {
    if (parContrat[p.contrat_id]) continue;
    const { contrat_id, ...reste } = p;
    parContrat[contrat_id] = reste;
  }
  return parContrat;
}
