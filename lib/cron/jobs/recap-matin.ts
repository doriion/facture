import "server-only";

import type { ContexteJob, JobDef } from "@/lib/cron/jobs";
import type { ResultatTache } from "@/lib/cron/journal";
import { envoyerNotification, pushConfigure } from "@/lib/push/envoi";
import { texteRecapMatin, type RdvRecap } from "@/lib/recap-matin";
import { ajouterJours } from "@/lib/agenda-vues";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";

/** Devis envoyé sans réponse depuis ce délai : à relancer. */
export const DELAI_RELANCE_DEVIS_JOURS = 7;

/**
 * Récapitulatif du matin, en notification sur le téléphone : rendez-vous
 * du jour, interventions et devis à facturer, devis à relancer, factures
 * et tâches en retard. Suit l'interrupteur des rappels push ; sans
 * appareil abonné, rien ne part. Aucun e-mail, aucun client concerné.
 */
export const jobRecapMatin: JobDef = {
  tache: "recap-matin",
  concerneLesClients: false,
  estActive: (profil) => profil.auto_rappels_push_active === true,
  doitTournerAujourdhui: () => true,
  executer: async (ctx) => executerRecap(ctx),
};

async function executerRecap({ service, userId, today, dryRun }: ContexteJob): Promise<ResultatTache> {
  if (!pushConfigure()) return { statut: "succes", details: "Push non configuré (clés VAPID absentes)." };
  const { data: abonnements } = await service.from("push_abonnements").select("endpoint, p256dh, auth").eq("user_id", userId);
  if (!abonnements || abonnements.length === 0) {
    return { statut: "succes", details: "Aucun appareil abonné aux notifications." };
  }

  const limiteRelance = ajouterJours(today, -DELAI_RELANCE_DEVIS_JOURS);
  const [rdv, aFacturer, retards, taches, devisAcceptes, devisEnvoyes] = await Promise.all([
    service
      .from("interventions")
      .select("heure_debut, description, type, client:clients(nom)")
      .eq("user_id", userId)
      .is("supprime_le", null)
      .lte("date_intervention", today)
      .or(`date_fin.gte.${today},and(date_fin.is.null,date_intervention.eq.${today})`)
      .order("heure_debut", { ascending: true, nullsFirst: false }),
    service.from("interventions").select("id", { count: "exact", head: true }).eq("user_id", userId).is("supprime_le", null).eq("a_facturer", true).is("facture_id", null).lt("date_intervention", today),
    service.from("factures").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("statut", "envoyee").lt("date_echeance", today),
    service.from("taches").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("fait", false).lt("date_echeance", today),
    service.from("devis").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("est_modele", false).eq("statut", "accepte").is("facture_id", null),
    service.from("devis").select("id, date_emission, email_envoye_le, date_validite").eq("user_id", userId).eq("est_modele", false).eq("statut", "envoye").gte("date_validite", today),
  ]);

  const rdvRecap: RdvRecap[] = (rdv.data ?? []).map((i) => ({
    heure: i.heure_debut ? i.heure_debut.slice(0, 5) : null,
    libelle: [
      i.description?.trim() || LABELS_TYPE_INTERVENTION[i.type as keyof typeof LABELS_TYPE_INTERVENTION] || i.type,
      (i.client as { nom: string } | null)?.nom,
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  const nbDevisARelancer = (devisEnvoyes.data ?? []).filter((d) => {
    const dernier = (d.email_envoye_le ?? `${d.date_emission}T00:00:00Z`).slice(0, 10);
    return dernier <= limiteRelance;
  }).length;

  const recap = texteRecapMatin({
    rdv: rdvRecap,
    nbAFacturer: aFacturer.count ?? 0,
    nbFacturesEnRetard: retards.count ?? 0,
    nbTachesEnRetard: taches.count ?? 0,
    nbDevisAcceptesAFacturer: devisAcceptes.count ?? 0,
    nbDevisARelancer,
  });
  if (!recap) return { statut: "succes", details: "Rien à annoncer ce matin." };
  if (dryRun) return { statut: "succes", details: `[simulation] ${recap.titre} — ${recap.corps}` };

  let envoyes = 0;
  for (const a of abonnements) {
    const r = await envoyerNotification(a, { titre: recap.titre, corps: recap.corps, url: recap.url, tag: `recap-${today}` });
    if (r.resultat === "ok") envoyes += 1;
    if (r.resultat === "expire") await service.from("push_abonnements").delete().eq("endpoint", a.endpoint).eq("user_id", userId);
  }
  return { statut: "succes", details: `Récap envoyé à ${envoyes} appareil(s) : ${recap.titre}` };
}
