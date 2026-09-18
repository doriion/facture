import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { estAppelCronAutorise } from "@/lib/cron/protect";
import { journaliser } from "@/lib/cron/journal";
import { aujourdhuiParis } from "@/lib/dates";
import { envoyerNotification, pushConfigure } from "@/lib/push/envoi";
import { adresseClient } from "@/lib/agenda-contact";
import {
  contenuRappel,
  joursACharger,
  rappelsDus,
  type InterventionARappeler,
} from "@/lib/rappels-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Rappels push avant les rendez-vous — appelé TOUTES LES 5 MINUTES par
 * pg_cron (Supabase) via pg_net, avec `Authorization: Bearer
 * PUSH_CRON_SECRET` (secret distinct de CRON_SECRET, propre à ce
 * déclencheur). Refuse tout appel sans le secret exact.
 *
 * Pour chaque utilisateur qui a activé les rappels ET au moins un
 * appareil abonné : les rendez-vous d'aujourd'hui et de demain dont
 * l'instant de rappel vient de passer (lib/rappels-push) reçoivent une
 * notification sur chaque appareil ; le rendez-vous est marqué
 * `rappel_push_envoye_le` (jamais deux rappels). Un abonnement expiré
 * (404 / 410) est retiré.
 */
export async function GET(request: Request) {
  if (!estAppelCronAutorise(request)) {
    return new NextResponse("Non autorisé", { status: 401 });
  }
  if (!pushConfigure()) {
    return NextResponse.json({ ok: false, error: "Clés VAPID manquantes." }, { status: 500 });
  }

  const service = createServiceClient();
  const maintenant = Date.now();
  const { depuis, jusquau } = joursACharger(maintenant);

  const { data: profils, error } = await service
    .from("profil_entreprise")
    .select("user_id, auto_rappels_push_active, rappels_push_delai_minutes")
    .eq("auto_rappels_push_active", true);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const compteRendu: Array<{ user: string; rappels: number; envoyes: number; expires: number; erreurs: number }> = [];

  for (const profil of profils ?? []) {
    const userId = profil.user_id;
    const { data: abonnements } = await service
      .from("push_abonnements")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (!abonnements || abonnements.length === 0) continue;

    const { data: rows } = await service
      .from("interventions")
      .select(
        "id, date_intervention, heure_debut, heure_fin, description, type, rappel_push_envoye_le, client:clients(nom, adresse_ligne1, adresse_ligne2, code_postal, ville)",
      )
      .eq("user_id", userId)
      .is("rappel_push_envoye_le", null)
      .is("supprime_le", null)
      .gte("date_intervention", depuis)
      .lte("date_intervention", jusquau);

    type Row = InterventionARappeler & {
      client: { nom: string; adresse_ligne1: string | null; adresse_ligne2: string | null; code_postal: string | null; ville: string | null } | null;
    };
    const candidats: InterventionARappeler[] = ((rows ?? []) as Row[]).map((r) => ({
      id: r.id,
      date_intervention: r.date_intervention,
      heure_debut: r.heure_debut,
      heure_fin: r.heure_fin,
      description: r.description,
      type: r.type,
      rappel_push_envoye_le: r.rappel_push_envoye_le,
      client_nom: r.client?.nom ?? null,
      client_adresse: r.client ? adresseClient(r.client) : null,
    }));
    const delai = profil.rappels_push_delai_minutes ?? 30;
    const dus = rappelsDus(candidats, maintenant, delai);

    let envoyes = 0;
    let expires = 0;
    let erreurs = 0;
    let rearmes = 0;
    for (const i of dus) {
      // Marqué AVANT l'envoi : un déclencheur concurrent ne renvoie pas.
      const { data: marque } = await service
        .from("interventions")
        .update({ rappel_push_envoye_le: new Date(maintenant).toISOString() })
        .eq("id", i.id)
        .is("rappel_push_envoye_le", null)
        .select("id");
      if (!marque || marque.length === 0) continue;

      const contenu = contenuRappel(i, delai);
      let joints = 0;
      for (const a of abonnements) {
        const r = await envoyerNotification(a, contenu);
        if (r.resultat === "ok") {
          envoyes += 1;
          joints += 1;
          await service
            .from("push_abonnements")
            .update({ derniere_utilisation: new Date(maintenant).toISOString() })
            .eq("endpoint", a.endpoint);
        } else if (r.resultat === "expire") {
          expires += 1;
          await service.from("push_abonnements").delete().eq("endpoint", a.endpoint);
        } else {
          erreurs += 1;
          console.error("[cron:rappels-push]", r.erreur);
        }
      }
      // Aucun appareil joint (erreur réseau, service push indisponible) :
      // on réarme le rappel, le passage suivant réessaie tant que la
      // fenêtre de grâce n'est pas passée.
      if (joints === 0 && erreurs > 0) {
        await service
          .from("interventions")
          .update({ rappel_push_envoye_le: null })
          .eq("id", i.id);
        rearmes += 1;
      }
    }
    compteRendu.push({ user: userId, rappels: dus.length, envoyes, expires, erreurs });
    // Journal (une ligne par jour, cumulée) dès qu'il s'est passé
    // quelque chose : l'écran Paramètres montre ainsi que les rappels
    // vivent, et une panne d'envoi devient visible.
    if (dus.length > 0) {
      const today = aujourdhuiParis();
      const { data: ligne } = await service
        .from("taches_journal")
        .select("details")
        .eq("user_id", userId)
        .eq("tache", "rappels-push")
        .eq("date_execution", today)
        .maybeSingle();
      const cumul = `${ligne?.details ? `${ligne.details} · ` : ""}${new Date(maintenant).toISOString().slice(11, 16)} UTC : ${envoyes} envoyé(s)${erreurs ? `, ${erreurs} erreur(s)` : ""}${rearmes ? `, ${rearmes} réarmé(s)` : ""}${expires ? `, ${expires} appareil(s) expiré(s)` : ""}`;
      try {
        await journaliser(
          service,
          userId,
          "rappels-push",
          today,
          { statut: erreurs > 0 && envoyes === 0 ? "erreur" : "succes", details: cumul },
          false,
        );
      } catch (e) {
        console.error("[cron:rappels-push] journal", e instanceof Error ? e.message : e);
      }
    }
  }

  return NextResponse.json({ ok: true, a: new Date(maintenant).toISOString(), utilisateurs: compteRendu });
}
