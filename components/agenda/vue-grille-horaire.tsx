"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import type { AgendaEvent } from "@/lib/actions/agenda";
import {
  DUREE_MIN_ETIREMENT,
  arrondirAuPas,
  estDeplacable,
  minutesDeHeure,
  type CibleDeplacement,
} from "@/lib/agenda-deplacement";
import {
  DUREE_DEFAUT_MIN,
  bornesGrille,
  creneauDepuisHeures,
  creneauxDuJour,
  dispositionGrille,
  hauteurGrille,
  heureCourte,
  heureDeY,
  heuresOccupees,
  horodatesDuJour,
  journeeEntiere,
  joursSemaine,
  libelleJour,
  libelleJourCourt,
  minutesDeY,
  yDeMinutes,
} from "@/lib/agenda-vues";
import { cn } from "@/lib/utils";
import { libelleEvenement } from "@/components/agenda/evenement-commun";
import { useDeplacement, type PointDeplacement } from "@/components/agenda/use-deplacement";

/** Hauteur d'une heure vide en vue jour (les heures pleines gardent 64 px). */
const HAUTEUR_COMPACTE = 26;

/** « 14:15 » depuis des minutes depuis minuit. */
function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes depuis minuit, heure locale du téléphone. */
function minutesMaintenant(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Grille horaire partagée par les vues JOUR (une colonne, créneaux
 * larges pour le doigt) et SEMAINE (lundi → samedi, dimanche
 * repliable : c'est la vue « créneaux libres » quand un client appelle).
 * Les évènements sans heure vont dans le bandeau « Journée » en haut ;
 * les horodatés sont posés sur la grille 7h → 20h (élargie si un
 * évènement déborde) d'après leurs heures. En vue jour, les heures
 * vides sont compactées pour ne pas faire défiler du blanc ; une ligne
 * rouge marque l'heure actuelle et la grille s'y positionne à
 * l'ouverture.
 * Un clic sur une ligne vide planifie une intervention ce jour-là À
 * CETTE HEURE (14 h → 14:00–15:00) ; un clic-glisser sur plusieurs
 * lignes donne la plage (14 h → 16 h). Sur téléphone, un tap suffit ;
 * le défilement vertical reste au navigateur (touch-action: pan-y).
 * Un créneau (intervention non facturée) se DÉPLACE en le tirant à la
 * souris, ou au doigt après un appui long : il suit le pointeur, se
 * cale au quart d'heure et change de jour en changeant de colonne ; un
 * fantôme montre où il va se poser. Les « journée entière » se déposent
 * sur un jour.
 */
export function VueGrilleHoraire({
  mode,
  date,
  aujourdhui,
  events,
  holidays,
  style,
  onOuvrir,
  onPlanifier,
  onDeplacer,
  onRedimensionner,
}: {
  mode: "jour" | "semaine";
  date: string;
  aujourdhui: string;
  events: AgendaEvent[];
  holidays: Record<string, string>;
  style: (e: AgendaEvent) => React.CSSProperties | undefined;
  onOuvrir: (e: AgendaEvent) => void;
  /**
   * Planifier une intervention : le jour, et — depuis la grille — les
   * heures de début et de fin (exclusive) du créneau cliqué ou glissé.
   */
  onPlanifier: (ymd: string, heures?: { debut: number; fin: number }) => void;
  /** Déposer un créneau glissé : jour et, sur la grille, heure de début (minutes). */
  onDeplacer?: (e: AgendaEvent, cible: CibleDeplacement) => void;
  /** Créneau étiré par le bas : nouvelle heure de fin (minutes depuis minuit). */
  onRedimensionner?: (e: AgendaEvent, finMinutes: number) => void;
}) {
  const [dimanche, setDimanche] = useState(false);
  const jours =
    mode === "jour" ? [date] : joursSemaine(date).slice(0, dimanche ? 7 : 6);
  const hauteurHeure = mode === "jour" ? 64 : 48; // px

  // Heure actuelle (minutes) : connue seulement après le montage pour
  // ne pas diverger du rendu serveur ; rafraîchie chaque minute.
  const [maintenant, setMaintenant] = useState<number | null>(null);
  useEffect(() => {
    setMaintenant(minutesMaintenant());
    const id = window.setInterval(() => setMaintenant(minutesMaintenant()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const aujourdhuiAffiche = jours.includes(aujourdhui);
  const heureActuelle =
    aujourdhuiAffiche && maintenant !== null ? Math.floor(maintenant / 60) : null;

  // Disposition : bornes élargies aux évènements, heures vides compactées
  // en vue jour (la semaine garde des lignes régulières pour lire les
  // créneaux libres d'un coup d'œil).
  const bornes = bornesGrille(events, jours);
  const lignes = dispositionGrille({
    debut: bornes.debut,
    fin: bornes.fin,
    occupees: heuresOccupees(events, jours),
    hauteurPleine: hauteurHeure,
    hauteurCompacte: HAUTEUR_COMPACTE,
    compacter: mode === "jour",
    heureActuelle,
  });
  const hauteur = hauteurGrille(lignes);

  // À l'ouverture, on amène l'heure actuelle au milieu de l'écran (une
  // fois par montage ; la clé du conteneur change avec la date).
  const ligneMaintenant = useRef<HTMLDivElement>(null);
  const aDefile = useRef(false);
  useEffect(() => {
    if (aDefile.current || maintenant === null || !ligneMaintenant.current) return;
    aDefile.current = true;
    ligneMaintenant.current.scrollIntoView({ block: "center" });
  }, [maintenant]);

  // Sélection en cours sur la grille (clic ou clic-glisser) : jour,
  // ligne de départ et ligne sous le pointeur. Relâcher planifie.
  const [selection, setSelection] = useState<{
    jour: string;
    debut: number;
    fin: number;
  } | null>(null);
  // Point de départ du pointeur : un mouvement surtout horizontal est un
  // swipe (changer de jour / de semaine), pas une sélection de créneau.
  const origine = useRef<{ x: number; y: number } | null>(null);

  const heureSousPointeur = (ev: React.PointerEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    return heureDeY(lignes, ev.clientY - rect.top);
  };

  const debutSelection = (jour: string) => (ev: React.PointerEvent<HTMLDivElement>) => {
    // Bouton principal seulement, et jamais depuis un créneau existant
    // (qui a son propre clic → fiche).
    if (ev.button !== 0) return;
    if ((ev.target as HTMLElement).closest("[data-evenement]")) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    origine.current = { x: ev.clientX, y: ev.clientY };
    const h = heureSousPointeur(ev);
    setSelection({ jour, debut: h, fin: h });
  };

  const etendreSelection = (jour: string) => (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!selection || selection.jour !== jour) return;
    const o = origine.current;
    if (o) {
      const dx = Math.abs(ev.clientX - o.x);
      const dy = Math.abs(ev.clientY - o.y);
      if (dx > 24 && dx > dy) {
        // Swipe horizontal : on abandonne la sélection, le conteneur
        // gère le changement de jour / semaine.
        setSelection(null);
        if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
          ev.currentTarget.releasePointerCapture(ev.pointerId);
        }
        return;
      }
    }
    const h = heureSousPointeur(ev);
    if (h !== selection.fin) setSelection({ ...selection, fin: h });
  };

  const finirSelection = (jour: string) => (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!selection || selection.jour !== jour) return;
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    }
    const debut = Math.min(selection.debut, selection.fin);
    const fin = Math.max(selection.debut, selection.fin) + 1; // fin exclusive
    setSelection(null);
    onPlanifier(jour, { debut, fin });
  };

  const annulerSelection = () => setSelection(null);

  // Glisser-déposer d'un créneau. La cible se lit sous le pointeur :
  // la colonne (jour) et, pour un horodaté, la position du HAUT du
  // créneau (le point saisi garde son décalage) arrondie au quart d'heure.
  const dernierJour = useRef<string | null>(null);
  const resoudre = (e: AgendaEvent, p: PointDeplacement): CibleDeplacement | null => {
    const sous = document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>("[data-jour]");
    const jour = sous?.dataset.jour ?? dernierJour.current ?? e.date_start;
    dernierJour.current = jour;
    if (!e.heure_debut) return { jour };
    const colonne = document.querySelector<HTMLElement>(`[data-grille][data-jour="${jour}"]`);
    if (!colonne) return { jour };
    const top = p.y - p.decalageY - colonne.getBoundingClientRect().top;
    return { jour, debut: arrondirAuPas(minutesDeY(lignes, top)) };
  };
  const deplacement = useDeplacement<AgendaEvent, CibleDeplacement>({
    resoudre,
    onDeposer: (e, cible) => {
      dernierJour.current = null;
      onDeplacer?.(e, cible);
    },
    // Appui long relâché sur place : la fiche (menu) de l'évènement.
    onAppuiLong: onOuvrir,
    desactive: !onDeplacer,
  });

  // Étirement d'un créneau par sa poignée du bas : la fin suit le
  // pointeur (quart d'heure, 15 min au moins), le créneau se redessine
  // en direct, relâcher enregistre.
  const [redim, setRedim] = useState<{ e: AgendaEvent; jour: string; fin: number } | null>(null);
  const finSousPointeur = (e: AgendaEvent, jour: string, y: number) => {
    const colonne = document.querySelector<HTMLElement>(`[data-grille][data-jour="${jour}"]`);
    if (!colonne || !e.heure_debut) return null;
    const brut = arrondirAuPas(minutesDeY(lignes, y - colonne.getBoundingClientRect().top));
    return Math.max(brut, minutesDeHeure(e.heure_debut) + DUREE_MIN_ETIREMENT);
  };
  const poigneeEtirement = (e: AgendaEvent, jour: string) => ({
    onPointerDown: (ev: React.PointerEvent<HTMLElement>) => {
      if (ev.button !== 0) return;
      ev.stopPropagation();
      ev.preventDefault();
      ev.currentTarget.setPointerCapture(ev.pointerId);
      const fin = e.heure_fin
        ? minutesDeHeure(e.heure_fin)
        : minutesDeHeure(e.heure_debut!) + DUREE_DEFAUT_MIN;
      setRedim({ e, jour, fin });
    },
    onPointerMove: (ev: React.PointerEvent<HTMLElement>) => {
      if (!redim || redim.e.id !== e.id) return;
      const fin = finSousPointeur(e, jour, ev.clientY);
      if (fin !== null && fin !== redim.fin) setRedim({ ...redim, fin });
    },
    onPointerUp: (ev: React.PointerEvent<HTMLElement>) => {
      if (!redim || redim.e.id !== e.id) return;
      if (ev.currentTarget.hasPointerCapture(ev.pointerId)) {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      }
      const fin = finSousPointeur(e, jour, ev.clientY) ?? redim.fin;
      setRedim(null);
      onRedimensionner?.(e, fin);
    },
    onPointerCancel: () => setRedim(null),
    onClick: (ev: React.MouseEvent) => ev.stopPropagation(),
    onTouchEnd: (ev: React.TouchEvent) => ev.stopPropagation(),
  });
  const glisse = deplacement.enCours;
  const dureeGlissee = (e: AgendaEvent) =>
    e.heure_debut && e.heure_fin
      ? Math.max(minutesDeHeure(e.heure_fin) - minutesDeHeure(e.heure_debut), 15)
      : DUREE_DEFAUT_MIN;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* En-tête des jours (semaine) + bandeau journée entière */}
      <div
        className="grid border-b"
        style={{ gridTemplateColumns: `3rem repeat(${jours.length}, minmax(0, 1fr))` }}
      >
        <div className="border-r px-1 py-1 text-[10px] uppercase text-muted-foreground">
          {mode === "semaine" && (
            <button
              type="button"
              onClick={() => setDimanche((v) => !v)}
              className="text-[10px] underline-offset-2 hover:underline"
              title={dimanche ? "Masquer le dimanche" : "Afficher le dimanche"}
            >
              {dimanche ? "− dim." : "+ dim."}
            </button>
          )}
        </div>
        {jours.map((jour) => {
          const entiers = journeeEntiere(events, jour);
          const ferie = holidays[jour];
          const cibleEntiere = glisse?.cible?.jour === jour && glisse.cible.debut === undefined;
          return (
            <div
              key={jour}
              data-jour={jour}
              className={cn(
                "min-w-0 border-r px-1 py-1 last:border-r-0",
                cibleEntiere && "bg-primary/10 ring-2 ring-inset ring-primary",
              )}
            >
              {mode === "semaine" && (
                <div
                  className={cn(
                    "truncate text-center text-xs font-medium",
                    jour === aujourdhui && "text-primary",
                    ferie && "text-muted-foreground",
                  )}
                  title={ferie}
                >
                  <span className="sm:hidden">{libelleJourCourt(jour)}</span>
                  <span className="hidden sm:inline">{libelleJour(jour)}</span>
                </div>
              )}
              {ferie && (
                <div className="truncate text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                  {ferie}
                </div>
              )}
              <div className="mt-1 space-y-0.5">
                {entiers.map((e) => (
                  <button
                    key={`${e.kind}-${e.id}`}
                    type="button"
                    onClick={() => onOuvrir(e)}
                    {...(onDeplacer && estDeplacable(e) ? deplacement.poignee(e) : {})}
                    onContextMenu={(ev) => {
                      ev.preventDefault();
                      onOuvrir(e);
                    }}
                    style={style(e)}
                    className={cn(
                      "block w-full truncate rounded px-1.5 text-left text-[11px] leading-6 ring-1 ring-inset ring-black/10 hover:brightness-95 dark:ring-white/20 dark:hover:brightness-110",
                      mode === "jour" && "text-sm leading-8",
                      onDeplacer && estDeplacable(e) && "poignee-deplacement cursor-grab",
                      glisse?.e.id === e.id && glisse.e.kind === e.kind && "opacity-40",
                    )}
                  >
                    {libelleEvenement(e)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grille horaire */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `3rem repeat(${jours.length}, minmax(0, 1fr))` }}
      >
        {/* Colonne des heures */}
        <div className="relative border-r" style={{ height: hauteur }}>
          {lignes.map((l, i) => (
            <div
              key={l.heure}
              className={cn(
                "absolute right-1 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground",
                l.compacte && "opacity-60",
              )}
              style={{ top: l.top }}
            >
              {i === 0 ? "" : `${String(l.heure).padStart(2, "0")}:00`}
            </div>
          ))}
        </div>
        {jours.map((jour) => {
          const creneaux = creneauxDuJour(horodatesDuJour(events, jour), bornes);
          const sel = selection?.jour === jour ? selection : null;
          const selDebut = sel ? Math.min(sel.debut, sel.fin) : 0;
          const selFin = sel ? Math.max(sel.debut, sel.fin) + 1 : 0;
          const yMaintenant =
            jour === aujourdhui &&
            maintenant !== null &&
            maintenant >= bornes.debut * 60 &&
            maintenant <= bornes.fin * 60
              ? yDeMinutes(lignes, maintenant)
              : null;
          return (
            <div
              key={jour}
              data-jour={jour}
              data-grille=""
              className={cn(
                "relative select-none border-r last:border-r-0",
                jour === aujourdhui && "bg-primary/[0.03]",
                holidays[jour] && "bg-muted/40",
              )}
              style={{ height: hauteur, touchAction: "pan-y" }}
              onPointerDown={debutSelection(jour)}
              onPointerMove={etendreSelection(jour)}
              onPointerUp={finirSelection(jour)}
              onPointerCancel={annulerSelection}
            >
              {/* Lignes d'heures : cliquer (ou glisser) planifie à cette heure */}
              {lignes.map((l) => (
                <div
                  key={l.heure}
                  data-heure={l.heure}
                  title={`Planifier le ${libelleJour(jour)} à ${l.heure} h`}
                  className={cn(
                    "group absolute inset-x-0 cursor-pointer border-t border-border/60 hover:bg-accent/40",
                    l.compacte && "bg-muted/20",
                  )}
                  style={{ top: l.top, height: l.height }}
                >
                  {!l.compacte && (
                    <Plus className="absolute right-1 top-1 size-3 text-primary opacity-0 group-hover:opacity-60" />
                  )}
                </div>
              ))}
              {/* Heure actuelle */}
              {yMaintenant !== null && (
                <div
                  ref={ligneMaintenant}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-20"
                  style={{ top: yMaintenant }}
                >
                  <div className="absolute -left-1 -top-1 size-2 rounded-full bg-red-500" />
                  <div className="h-0.5 w-full bg-red-500" />
                </div>
              )}
              {/* Sélection en cours (clic-glisser) */}
              {sel && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md bg-primary/15 ring-1 ring-inset ring-primary"
                  style={{
                    top: yDeMinutes(lignes, selDebut * 60),
                    height: yDeMinutes(lignes, selFin * 60) - yDeMinutes(lignes, selDebut * 60),
                  }}
                >
                  <span className="absolute left-1 top-0.5 text-[11px] font-medium text-primary">
                    {creneauDepuisHeures(selDebut, selFin).heure_debut}–
                    {creneauDepuisHeures(selDebut, selFin).heure_fin}
                  </span>
                </div>
              )}
              {/* Fantôme du créneau glissé, à l'endroit où il va se poser */}
              {glisse?.cible?.jour === jour && glisse.cible.debut !== undefined && (() => {
                const debut = glisse.cible.debut;
                const top = yDeMinutes(lignes, debut);
                const height = Math.max(
                  yDeMinutes(lignes, debut + dureeGlissee(glisse.e)) - top,
                  18,
                );
                const fin = glisse.e.heure_fin ? debut + dureeGlissee(glisse.e) : null;
                return (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-md px-1.5 py-0.5 shadow-lg ring-2 ring-primary",
                      mode === "jour" ? "text-sm" : "text-[11px] leading-tight",
                    )}
                    style={{ ...style(glisse.e), top, height }}
                  >
                    <span className="block truncate font-medium">
                      {formatMinutes(debut)}
                      {fin !== null ? `–${formatMinutes(fin)}` : ""}
                    </span>
                    <span className="block truncate">{libelleEvenement(glisse.e)}</span>
                  </div>
                );
              })()}
              {/* Créneaux */}
              {creneaux.map(({ evenement: e, creneau }) => {
                const largeur = 100 / creneau.colonnes;
                const top = yDeMinutes(lignes, creneau.debut);
                const enEtirement = redim?.e.id === e.id && redim.e.kind === e.kind;
                const height = Math.max(
                  yDeMinutes(lignes, enEtirement ? redim.fin : creneau.fin) - top,
                  18,
                );
                const deplacable = Boolean(onDeplacer) && estDeplacable(e);
                const etirable = Boolean(onRedimensionner) && estDeplacable(e) && Boolean(e.heure_debut);
                return (
                  <button
                    key={`${e.kind}-${e.id}`}
                    type="button"
                    data-evenement=""
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onOuvrir(e);
                    }}
                    {...(deplacable ? deplacement.poignee(e) : {})}
                    onContextMenu={(ev) => {
                      ev.preventDefault();
                      onOuvrir(e);
                    }}
                    style={{
                      ...style(e),
                      top,
                      height,
                      left: `calc(${creneau.colonne * largeur}% + 2px)`,
                      width: `calc(${largeur}% - 4px)`,
                    }}
                    className={cn(
                      "group absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left ring-1 ring-inset ring-black/10 hover:brightness-95 dark:ring-white/20 dark:hover:brightness-110",
                      mode === "jour" ? "text-sm" : "text-[11px] leading-tight",
                      deplacable && "poignee-deplacement cursor-grab active:cursor-grabbing",
                      glisse?.e.id === e.id && glisse.e.kind === e.kind && "opacity-40",
                      enEtirement && "z-30 shadow-lg ring-2 ring-primary",
                    )}
                    title={deplacable ? `${libelleEvenement(e)} — glisser pour déplacer` : libelleEvenement(e)}
                  >
                    <span className="block truncate font-medium">
                      {heureCourte(e.heure_debut)}
                      {enEtirement
                        ? `–${formatMinutes(redim.fin)}`
                        : e.heure_fin
                          ? `–${heureCourte(e.heure_fin)}`
                          : ""}
                    </span>
                    <span className="block truncate">{libelleEvenement(e)}</span>
                    {/* Poignée du bas : étirer pour changer la durée (touch-action none :
                        le doigt qui la tient n'a pas à faire défiler la page). */}
                    {etirable && height >= 28 && (
                      <span
                        role="presentation"
                        data-poignee-etirement=""
                        aria-hidden="true"
                        {...poigneeEtirement(e, jour)}
                        className="absolute inset-x-0 bottom-0 flex h-3.5 cursor-ns-resize items-end justify-center pb-0.5 [touch-action:none] [@media(hover:none)]:h-7 [@media(hover:none)]:pb-1"
                        title="Étirer pour changer la durée"
                      >
                        <span className="h-1 w-8 rounded-full bg-black/25 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-white/40 [@media(hover:none)]:h-1.5 [@media(hover:none)]:w-12 [@media(hover:none)]:opacity-80" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
