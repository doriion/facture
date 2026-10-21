import { CalendarCheck, CalendarX2, Clock, Send } from "lucide-react";

import type { PropositionResume } from "@/lib/actions/propositions-visite";
import { libelleCreneau } from "@/lib/creneaux-visite";
import { dateParis } from "@/lib/dates";
import { formatDateFr } from "@/lib/format";

/**
 * Où en est la dernière proposition de visite envoyée au client :
 * en attente de sa réponse, confirmée, autre créneau choisi, déclinée.
 */
export function StatutProposition({ proposition: p, compact = false }: { proposition: PropositionResume | undefined; compact?: boolean }) {
  if (!p || p.statut === "annulee") return null;
  const taille = compact ? "text-xs" : "text-sm";
  if (p.statut === "envoyee") {
    return (
      <p className={`flex items-center gap-1.5 ${taille} text-muted-foreground`}>
        <Send className="size-3.5 shrink-0" aria-hidden="true" />
        Proposée au client le {formatDateFr(dateParis(p.envoyee_le))}
        {p.origine === "automatique" ? " (automatique)" : ""}, en attente de sa réponse
      </p>
    );
  }
  if (p.statut === "refusee") {
    return (
      <p className={`flex items-start gap-1.5 ${taille} text-orange-700 dark:text-orange-300`}>
        <CalendarX2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Aucun créneau ne convenait au client{p.repondu_le ? ` (le ${formatDateFr(dateParis(p.repondu_le))})` : ""}
          {p.message_client ? ` : « ${p.message_client} »` : "."} À recontacter.
        </span>
      </p>
    );
  }
  const choix = p.choix_date
    ? libelleCreneau({ date: p.choix_date, debut: p.choix_debut?.slice(0, 5) ?? null, fin: p.choix_fin?.slice(0, 5) ?? null })
    : null;
  return (
    <p className={`flex items-start gap-1.5 ${taille} text-emerald-700 dark:text-emerald-300`}>
      {p.statut === "confirmee" ? (
        <CalendarCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>
        {p.statut === "confirmee" ? "Créneau confirmé par le client" : "Autre créneau choisi par le client"}
        {p.repondu_le ? ` le ${formatDateFr(dateParis(p.repondu_le))}` : ""}
        {choix ? ` : ${choix}` : ""}, rendez-vous dans l&apos;agenda.
      </span>
    </p>
  );
}
