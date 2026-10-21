"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { disponibilitesAction } from "@/lib/actions/disponibilites";
import type { DisponibiliteJour } from "@/lib/creneaux-visite";
import { libelleJourCourt, libelleJourLong } from "@/lib/agenda-vues";
import { heureLisible } from "@/lib/visite-entretien";

/**
 * Quand on choisit une date de visite : les 14 jours à partir de cette
 * date, matin et après-midi libres (vert) ou pris (rouge), jours non
 * travaillés grisés ; et le détail de ce qui occupe le jour choisi. Un
 * tap sur un jour le sélectionne.
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
  const [jours, setJours] = useState<DisponibiliteJour[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Fenêtre chargée : on ne recharge que si la date sort de la bande.
  const [depuis, setDepuis] = useState<string | null>(null);

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const dansLaBande = depuis && jours.some((j) => j.date === date);
    if (dansLaBande) return;
    let annule = false;
    setChargement(true);
    setErreur(null);
    disponibilitesAction(date, contratId ?? null, 14)
      .then((res) => {
        if (annule) return;
        if (!res.ok) {
          setErreur(res.error);
          return;
        }
        setJours(res.data);
        setDepuis(res.data[0]?.date ?? date);
      })
      .catch(() => !annule && setErreur("Disponibilités indisponibles pour le moment."))
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, [date, contratId, depuis, jours]);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return <DisponibilitesVue jours={jours} date={date} chargement={chargement} erreur={erreur} onChoisirDate={onChoisirDate} />;
}

/** Présentation seule (sans chargement) : testable et prévisualisable. */
export function DisponibilitesVue({
  jours,
  date,
  chargement = false,
  erreur = null,
  onChoisirDate,
}: {
  jours: DisponibiliteJour[];
  date: string;
  chargement?: boolean;
  erreur?: string | null;
  onChoisirDate: (date: string) => void;
}) {
  const choisi = jours.find((j) => j.date === date);

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2 text-xs" data-testid="disponibilites">
      <div className="flex items-center justify-between">
        <span className="font-medium">Vos disponibilités</span>
        {chargement && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
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
