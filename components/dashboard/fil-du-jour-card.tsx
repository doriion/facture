import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  ListTodo,
  MapPin,
  Phone,
  Receipt,
  Send,
} from "lucide-react";

import type { FilDuJour, RdvDuJour } from "@/lib/actions/fil-du-jour";
import type { FactureEnRetard } from "@/lib/actions/relances";
import type { TacheDuJour } from "@/lib/actions/taches";
import { lienAppel, lienItineraire } from "@/lib/agenda-contact";
import { heureCourte, libelleJourLong } from "@/lib/agenda-vues";
import { formatDateFr, formatEuros } from "@/lib/format";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_TACHES = 6;
const MAX_RELANCES = 4;

/**
 * Fil « Aujourd'hui » en tête du tableau de bord : les rendez-vous du
 * jour, les interventions terminées à facturer, les factures à relancer
 * et les tâches, en une seule liste à parcourir le matin. Chaque ligne
 * mène à l'action (fiche, « Facturer », « Relancer », tâches).
 */
export function FilDuJourCard({
  fil,
  taches,
  relances,
}: {
  fil: FilDuJour;
  taches: TacheDuJour[];
  relances: FactureEnRetard[];
}) {
  const total = fil.rdv.length + fil.nbAFacturer + relances.length + taches.length;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <CalendarCheck className="size-4 text-primary" />
          Aujourd&apos;hui
          <span className="font-normal text-muted-foreground">{libelleJourLong(fil.date)}</span>
          {total > 0 && <Badge variant="secondary">{total}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {total === 0 && (
          <p className="text-sm text-muted-foreground">
            Rien de prévu aujourd&apos;hui, aucune facture ni relance en attente.
          </p>
        )}

        {fil.rdv.length > 0 && (
          <Section titre="Rendez-vous" nb={fil.rdv.length}>
            {fil.rdv.map((r) => (
              <Rdv key={`${r.kind}-${r.id}`} rdv={r} />
            ))}
          </Section>
        )}

        {fil.nbAFacturer > 0 && (
          <Section titre="À facturer" nb={fil.nbAFacturer} icone={<Receipt className="size-3.5" />}>
            {fil.aFacturer.map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-1.5 text-sm">
                <Link href={`/interventions/${i.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="font-medium">
                    {i.description ||
                      LABELS_TYPE_INTERVENTION[i.type as keyof typeof LABELS_TYPE_INTERVENTION] ||
                      i.type}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDateFr(i.date_intervention)}
                    {i.client_nom ? ` · ${i.client_nom}` : ""}
                  </span>
                </Link>
                <Button asChild size="sm">
                  <Link href={`/factures/nouvelle?intervention=${i.id}`}>Facturer</Link>
                </Button>
              </li>
            ))}
            {fil.nbAFacturer > fil.aFacturer.length && (
              <li className="pt-1 text-xs">
                <Link href="/agenda" className="text-primary hover:underline">
                  + {fil.nbAFacturer - fil.aFacturer.length} autre(s) à facturer
                </Link>
              </li>
            )}
          </Section>
        )}

        {relances.length > 0 && (
          <Section titre="Relances à envoyer" nb={relances.length} icone={<AlertTriangle className="size-3.5 text-amber-600" />}>
            {relances.slice(0, MAX_RELANCES).map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-1.5 text-sm">
                <Link href={`/factures/${f.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="font-mono font-medium">{f.numero}</span>
                  <span className="text-muted-foreground"> · {f.client_nom ?? "client"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatEuros(f.total_ht)} · {f.joursRetard} j de retard
                    {f.nbRelances > 0 ? ` · ${f.nbRelances} relance${f.nbRelances > 1 ? "s" : ""}` : ""}
                  </span>
                </Link>
                <Button asChild size="sm" variant="outline">
                  <Link href="/factures">
                    <Send className="size-3.5" />
                    Relancer
                  </Link>
                </Button>
              </li>
            ))}
            {relances.length > MAX_RELANCES && (
              <li className="pt-1 text-xs">
                <Link href="/factures" className="text-primary hover:underline">
                  + {relances.length - MAX_RELANCES} autre(s) en retard
                </Link>
              </li>
            )}
          </Section>
        )}

        {taches.length > 0 && (
          <Section titre="Tâches" nb={taches.length} icone={<ListTodo className="size-3.5" />}>
            {taches.slice(0, MAX_TACHES).map((t) => (
              <li key={t.id}>
                <Link
                  href="/taches"
                  className="flex items-center justify-between gap-2 rounded-md py-1.5 text-sm hover:bg-accent"
                >
                  <span className="min-w-0 truncate">
                    {t.titre}
                    {t.heure ? <span className="text-muted-foreground"> — {t.heure}</span> : null}
                  </span>
                  {t.joursRetard > 0 ? (
                    <Badge variant="destructive" className="shrink-0">
                      {t.joursRetard} j de retard
                    </Badge>
                  ) : t.priorite === "urgente" ? (
                    <Badge variant="outline" className="shrink-0 border-amber-500 text-amber-700">
                      urgent
                    </Badge>
                  ) : null}
                </Link>
              </li>
            ))}
            {taches.length > MAX_TACHES && (
              <li className="pt-1 text-xs">
                <Link href="/taches" className="text-primary hover:underline">
                  + {taches.length - MAX_TACHES} autre(s)
                </Link>
              </li>
            )}
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  titre,
  nb,
  icone,
  children,
}: {
  titre: string;
  nb: number;
  icone?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icone}
        {titre}
        <span className="font-normal">({nb})</span>
      </p>
      <ul className="divide-y">{children}</ul>
    </div>
  );
}

function Rdv({ rdv }: { rdv: RdvDuJour }) {
  const heure = heureCourte(rdv.heure_debut);
  const fin = heureCourte(rdv.heure_fin);
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
        {heure ? `${heure}${fin ? `–${fin}` : ""}` : "Journée"}
      </span>
      <Link href={rdv.href} className="min-w-0 flex-1 hover:underline">
        <span className="block truncate font-medium">{rdv.title}</span>
        {rdv.client_nom && (
          <span className="block truncate text-xs text-muted-foreground">{rdv.client_nom}</span>
        )}
      </Link>
      {rdv.client_telephone && (
        <Button asChild size="icon" variant="outline" className="size-11 sm:size-9">
          <a href={lienAppel(rdv.client_telephone)} aria-label={`Appeler ${rdv.client_nom ?? "le client"}`}>
            <Phone className="size-4" />
          </a>
        </Button>
      )}
      {rdv.client_adresse && (
        <Button asChild size="icon" variant="outline" className="size-11 sm:size-9">
          <a
            href={lienItineraire(rdv.client_adresse)}
            target="_blank"
            rel="noopener"
            aria-label="Itinéraire"
          >
            <MapPin className="size-4" />
          </a>
        </Button>
      )}
    </li>
  );
}
