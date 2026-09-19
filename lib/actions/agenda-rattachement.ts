"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { computeExternalEventKey } from "@/lib/external-event-key";

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type FactureOuverte = {
  id: string;
  numero: string;
  statut: string;
  date_emission: string;
  client_nom: string | null;
};

/**
 * Factures auxquelles un RDV peut être rattaché depuis l'agenda : les
 * brouillons et les factures envoyées, les plus récentes d'abord.
 */
export async function listFacturesOuvertesAction(): Promise<FactureOuverte[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("factures")
    .select("id, numero, statut, date_emission, client:clients(nom)")
    .in("statut", ["brouillon", "envoyee"])
    .order("date_emission", { ascending: false })
    .limit(30);
  type Row = {
    id: string;
    numero: string;
    statut: string;
    date_emission: string;
    client: { nom: string } | { nom: string }[] | null;
  };
  return ((data ?? []) as Row[]).map((r) => {
    const c = Array.isArray(r.client) ? r.client[0] : r.client;
    return {
      id: r.id,
      numero: r.numero,
      statut: r.statut,
      date_emission: r.date_emission,
      client_nom: c?.nom ?? null,
    };
  });
}

/**
 * Rattache UN RDV iPhone à une facture, depuis l'agenda. Même table et
 * mêmes clés que la section « Évènements couverts » de la fiche facture
 * (facture_external_events, computeExternalEventKey) ; un seul ajout,
 * sans toucher aux autres évènements déjà couverts par la facture.
 */
export async function rattacherRdvAFactureAction(
  factureId: string,
  evenement: { uid: string; title: string; date_start: string; date_end?: string },
): Promise<ActionResult<{ numero: string }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié." };

  const { data: facture } = await supabase
    .from("factures")
    .select("id, numero, statut")
    .eq("id", factureId)
    .maybeSingle();
  if (!facture) return { ok: false, error: "Facture introuvable." };

  const key = computeExternalEventKey({
    uid: evenement.uid,
    date_start: evenement.date_start,
    title: evenement.title,
  });

  // Déjà rattaché à une autre facture ? On ne l'arrache pas en silence.
  const { data: existant, error: erreurExistant } = await supabase
    .from("facture_external_events")
    .select("facture_id, factures:factures(numero)")
    .eq("external_uid", key.external_uid)
    .maybeSingle();
  // Une erreur (dont « plusieurs lignes ») ne doit pas valoir « libre ».
  if (erreurExistant) return { ok: false, error: erreurExistant.message };
  if (existant && existant.facture_id !== factureId) {
    const rel = Array.isArray(existant.factures) ? existant.factures[0] : existant.factures;
    return {
      ok: false,
      error: `Ce RDV est déjà rattaché à la facture ${(rel as { numero?: string } | null)?.numero ?? ""}.`.trim(),
    };
  }
  if (existant) return { ok: true, data: { numero: facture.numero } };

  const { error } = await supabase.from("facture_external_events").insert({
    user_id: user.id,
    facture_id: factureId,
    source: "ical_external",
    external_uid: key.external_uid,
    fallback_key: key.fallback_key,
    snapshot_title: evenement.title,
    snapshot_date_start: evenement.date_start,
    snapshot_date_end: evenement.date_end ?? evenement.date_start,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/agenda");
  revalidatePath(`/factures/${factureId}`);
  revalidatePath("/factures");
  return { ok: true, data: { numero: facture.numero } };
}
