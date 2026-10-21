"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { disponibilitesAction } from "@/lib/actions/disponibilites";
import type { DisponibiliteJour } from "@/lib/creneaux-visite";
import { ajouterJours, libelleJourCourt, libelleJourLong } from "@/lib/agenda-vues";
import { aujourdhuiParis } from "@/lib/dates";
import { heureLisible } from "@/lib/visite-entretien";

const NB_JOURS = 14;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Quand on choisit une date de visite : deux semaines à partir
 * d'aujourd'hui (ou de la date choisie si elle est plus loin), matin et
 * après-midi libres (vert) ou pris (rouge), jours non travaillés grisés,
 * flèches pour avancer ou reculer ; et le détail de ce qui occupe le
 * jour choisi. Un tap sur un jour le sélectionne.
 */
export function DisponibilitesApercu({
  date,
  contratId,
  onChoisirDate,
}: {
  date: string;
  contratId?: string | null;
  onChoisirDate: (date: string) => void;
}) {
  const [bande, setBande] = useState<{ depuis: string; jours: DisponibiliteJour[] } | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Dernière fenêtre demandée : une même demande ne part pas deux fois.
  const demandeRef = useRef<string | null>(null);
  const aujourdhui = aujourdhuiParis();

  function charger(depuisVoulu: string) {
    const depuis = depuisVoulu < aujourdhui ? aujourdhui : depuisVoulu;
    if (demandeRef.current === depuis) return;
    demandeRef.current = depuis;
    setChargement(true);
    setErreur(null);
    disponibilitesAction(depuis, contratId ?? null, NB_JOURS)
      .then((res) => {
        if (demandeRef.current !== depuis) return;
        if (!res.ok) {
          setErreur(res.error);
          return;
        }
        setBande({ depuis: res.data[0]?.date ?? depuis, jours: res.data });
      })
      .catch(() => {
        if (demandeRef.current === depuis) setErreur("Disponibilités indisponibles pour le moment.");
      })
      .finally(() => {
        if (demandeRef.current === depuis) setChargement(false);
      });
  }

  useEffect(() => {
    if (!DATE_RE.test(date)) return;
    const dernier = bande ? ajouterJours(bande.depuis, NB_JOURS - 1) : null;
    const dansLaBande = bande && dernier && date >= bande.depuis && date <= dernier;
    if (dansLaBande) return;
    charger(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- charger lit l'état courant ; seule la date déclenche
  }, [date, contratId]);

  if (!DATE_RE.test(date)) return null;
  const dernier = bande ? ajouterJours(bande.depuis, NB_JOURS - 1) : null;
  return (
    <DisponibilitesVue
      jours={bande?.jours ?? []}
      date={date}
      chargement={chargement}
      erreur={erreur}
      peutReculer={Boolean(bande && bande.depuis > aujourdhui)}
      onReculer={() => bande && charger(ajouterJours(bande.depuis, -NB_JOURS))}
      onAvancer={() => bande && dernier && charger(ajouterJours(dernier, 1))}
      onChoisirDate={onChoisirDate}
    />
  );
}

/** Présentation seule (sans chargement) : testable et prévisualisable. */
export function DisponibilitesVue({
  jours,
  date,
  chargement = false,
  erreur = null,
  peutReculer = false,
  onReculer,
  onAvancer,
  onChoisirDate,
}: {
  jours: DisponibiliteJour[];
  date: string;
  chargement?: boolean;
  erreur?: string | null;
  peutReculer?: boolean;
  onReculer?: () => void;
  onAvancer?: () => void;
  onChoisirDate: (date: string) => void;
}) {
  const choisi = jours.find((j) => j.date === date);
  const premier = jours[0]?.date;
  const dernier = jours[jours.length - 1]?.date;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2 text-xs" data-testid="disponibilites">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          Vos disponibilités
          {premier && dernier && (
            <span className="font-normal text-muted-foreground">
              {" "}· {libelleJourCourt(premier)} → {libelleJourCourt(dernier)}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          {chargement && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          <button
            type="button"
            onClick={onReculer}
            disabled={!peutReculer || chargement}
            className="rounded-md border bg-background p-1 disabled:opacity-40"
            aria-label="Deux semaines plus tôt"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onAvancer}
            disabled={jours.length === 0 || chargement}
            className="rounded-md border bg-background p-1 disabled:opacity-40"
            aria-label="Deux semaines plus tard"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </span>
      </div>
      {erreur && <p className="text-destructive">{erreur}</p>}
      {jours.length > 0 && (
        <div className="flex gap-1 overflow-x-auto pb-1" role="listbox" aria-label="Choisir un jour">
          {jours.map((j) => {
            const actif = j.date === date;
            return (
              <button
                key={j.date}
                type="button"
                role="option"
                aria-selected={actif}
                onClick={() => onChoisirDate(j.date)}
                title={libelleJourLong(j.date)}
                className={`flex w-11 shrink-0 flex-col items-center gap-1 rounded-md border px-1 py-1 ${
                  actif ? "border-primary bg-primary/10" : "bg-background"
                } ${j.travaille ? "" : "opacity-50"}`}
              >
                <span className="leading-tight">{libelleJourCourt(j.date)}</span>
                <span className="flex w-full gap-0.5">
                  {j.travaille ? (
                    j.tranches.map((t) => (
                      <span
                        key={t.debut}
                        className={`h-1.5 flex-1 rounded-sm ${t.libre ? "bg-emerald-500" : "bg-red-500"}`}
                        aria-label={`${heureLisible(t.debut)} – ${heureLisible(t.fin)} : ${t.libre ? "libre" : "pris"}`}
                      />
                    ))
                  ) : (
                    <span className="h-1.5 flex-1 rounded-sm bg-muted-foreground/30" aria-label="Jour non travaillé" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {!choisi && jours.length > 0 && (
        <p className="text-muted-foreground">
          La date choisie ({libelleJourLong(date)}) est hors de ces deux semaines : utilisez les flèches, ou tapez un jour.
        </p>
      )}
      {choisi && (
        <div className="space-y-0.5">
          <p className="font-medium">{libelleJourLong(choisi.date)}</p>
          {!choisi.travaille && <p className="text-muted-foreground">Jour non travaillé (Paramètres, créneaux proposés aux clients).</p>}
          {choisi.travaille &&
            choisi.tranches.map((t) => (
              <p key={t.debut} className={t.libre ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>
                {heureLisible(t.debut)} – {heureLisible(t.fin)} : {t.libre ? "libre" : "pris"}
              </p>
            ))}
          {choisi.occupations.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {choisi.occupations.map((o, i) => (
                <li key={i}>
                  {o.heure_debut
                    ? `${heureLisible(o.heure_debut)}${o.heure_fin ? ` – ${heureLisible(o.heure_fin)}` : ""}`
                    : "Journée"}{" "}
                  · {o.libelle}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
