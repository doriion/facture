import "server-only";

import type { JobDef, ContexteJob } from "@/lib/cron/jobs";
import type { ResultatTache } from "@/lib/cron/journal";
import { classerTaches } from "@/lib/taches-logic";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { formatDateFr } from "@/lib/format";

/**
 * Email quotidien « Tes tâches du jour » — envoyé à L'ARTISAN
 * uniquement (concerneLesClients: false, donc HORS mode simulation),
 * et seulement s'il y a des tâches échues aujourd'hui ou en retard.
 * ACTIVÉ par défaut ; interrupteur dans Paramètres.
 */
export const jobEmailTaches: JobDef = {
  tache: "taches-du-jour",
  concerneLesClients: false,
  estActive: (profil) => profil.auto_email_taches_active !== false,
  doitTournerAujourdhui: () => true,
  executer: async (ctx) => executerEmailTaches(ctx),
};

async function executerEmailTaches({
  service,
  userId,
  profil,
  today,
}: ContexteJob): Promise<ResultatTache> {
  const { data } = await service
    .from("taches")
    .select("id, titre, date_echeance, heure, priorite, fait, fait_le")
    .eq("user_id", userId)
    .eq("fait", false)
    .not("date_echeance", "is", null);

  const { enRetard, aujourdhui } = classerTaches(
    (data ?? []).map((t) => ({ ...t, heure: t.heure?.slice(0, 5) ?? null })),
    today,
  );
  const total = enRetard.length + aujourdhui.length;

  if (total === 0) {
    return {
      statut: "succes",
      details: "Aucune tâche échue ni en retard — pas d'email.",
    };
  }

  if (!profil.email_pro) {
    return {
      statut: "ignoree",
      details: `${total} tâche(s) du jour mais pas d'email pro configuré dans Paramètres.`,
    };
  }

  if (!isEmailConfigured()) {
    return {
      statut: "erreur",
      details: "Resend non configuré (RESEND_API_KEY / RESEND_FROM).",
    };
  }

  const ligne = (t: {
    titre: string;
    heure: string | null;
    priorite: string;
  }) =>
    `<li>${echapper(t.titre)}${t.heure ? ` — ${t.heure}` : ""}${
      t.priorite === "urgente" ? " <strong>(urgent)</strong>" : ""
    }</li>`;

  const sectionRetard = enRetard.length
    ? `<p style="color:#b91c1c;"><strong>En retard :</strong></p><ul>${enRetard
        .map(
          (t) =>
            `<li>${echapper(t.titre)} — <span style="color:#b91c1c;">${t.joursRetard} j de retard</span> (échéance ${formatDateFr(t.date_echeance!)})</li>`,
        )
        .join("")}</ul>`
    : "";

  const sectionJour = aujourdhui.length
    ? `<p><strong>Aujourd'hui :</strong></p><ul>${aujourdhui
        .map(ligne)
        .join("")}</ul>`
    : "";

  const res = await sendEmail({
    to: profil.email_pro,
    subject: `${total} tâche(s) à faire aujourd'hui — ${formatDateFr(today)}`,
    html: `<p>Bonjour,</p>${sectionRetard}${sectionJour}<p>Ouvrez le pense-bête pour cocher au fur et à mesure.</p><p>— Facture AE</p>`,
  });

  if (!res.ok) return { statut: "erreur", details: res.error };

  return {
    statut: "succes",
    details: `Email envoyé : ${enRetard.length} en retard, ${aujourdhui.length} aujourd'hui.`,
  };
}

function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
