"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { enregistrerClientDetecteAction } from "@/lib/actions/clients-agenda";
import { TYPES_INTERVENTION } from "@/lib/validations/intervention";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const rdvSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  heure: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  nom: z.string().trim().min(1).max(150),
  adresse: z.string().trim().max(200).nullable(),
  code_postal: z.string().trim().max(10).nullable(),
  ville: z.string().trim().max(100).nullable(),
  telephone: z.string().trim().max(30).nullable(),
  texte: z.string().trim().max(2000),
});

const tourneeSchema = z.object({
  rdv: z.array(rdvSchema).min(1, "Aucun rendez-vous à créer.").max(200),
  type: z.enum(TYPES_INTERVENTION),
  dureeMinutes: z.number().int().min(15).max(600),
  creerClients: z.boolean(),
  aFacturer: z.boolean(),
});

export type TourneeInput = z.input<typeof tourneeSchema>;

function heureFin(heure: string, dureeMinutes: number): string {
  const [h, m] = heure.split(":").map(Number);
  const total = Math.min((h ?? 0) * 60 + (m ?? 0) + dureeMinutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Crée d'un coup les rendez-vous d'une tournée : pour chacun, la fiche
 * client est retrouvée (même téléphone ou même nom) ou créée, puis
 * l'intervention est posée dans l'agenda avec le descriptif d'origine.
 * Un rendez-vous en échec n'empêche pas les autres ; le compte rendu
 * dit ce qui a été fait.
 */
export async function creerTourneeAction(input: TourneeInput): Promise<ActionResult<{ crees: number; clientsCrees: number; clientsRepris: number; echecs: string[] }>> {
  const parsed = tourneeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide." };
  const v = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  let crees = 0;
  let clientsCrees = 0;
  let clientsRepris = 0;
  const echecs: string[] = [];
  for (const r of v.rdv) {
    let clientId: string | null = null;
    if (v.creerClients) {
      const c = await enregistrerClientDetecteAction({
        nom: r.nom,
        telephone: r.telephone,
        email: null,
        adresse_ligne1: r.adresse,
        code_postal: r.code_postal,
        ville: r.ville,
      });
      if (c.ok) {
        clientId = c.data.id;
        if (c.data.existant) clientsRepris += 1;
        else clientsCrees += 1;
      } else {
        echecs.push(`${r.nom} : ${c.error}`);
      }
    }
    const { error } = await supabase.from("interventions").insert({
      user_id: user.id,
      client_id: clientId,
      date_intervention: r.date,
      heure_debut: r.heure ? `${r.heure}:00` : null,
      heure_fin: r.heure ? `${heureFin(r.heure, v.dureeMinutes)}:00` : null,
      type: v.type,
      description: r.texte.slice(0, 2000),
      a_facturer: v.aFacturer,
    });
    if (error) echecs.push(`${r.nom} (${r.date}) : ${error.message}`);
    else crees += 1;
  }
  revalidatePath("/agenda");
  revalidatePath("/interventions");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { ok: true, data: { crees, clientsCrees, clientsRepris, echecs } };
}
