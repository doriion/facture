/**
 * Récapitulatif du matin (notification) — texte PUR, testé.
 */

export type RdvRecap = { heure: string | null; libelle: string };

export type DonneesRecap = {
  rdv: RdvRecap[];
  nbAFacturer: number;
  nbFacturesEnRetard: number;
  nbTachesEnRetard: number;
  nbDevisAcceptesAFacturer: number;
  nbDevisARelancer: number;
};

export type Recap = { titre: string; corps: string; url: string } | null;

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/**
 * Titre = les rendez-vous ; corps = ce qui attend. Rien à dire → null
 * (pas de notification vide).
 */
export function texteRecapMatin(d: DonneesRecap): Recap {
  const titre =
    d.rdv.length === 0
      ? "Aucun rendez-vous aujourd'hui"
      : d.rdv.length === 1
        ? `1 rendez-vous : ${d.rdv[0]!.heure ? `${d.rdv[0]!.heure} ` : ""}${d.rdv[0]!.libelle}`
        : `${d.rdv.length} rendez-vous : ${d.rdv
            .slice(0, 3)
            .map((r) => `${r.heure ? `${r.heure} ` : ""}${r.libelle}`)
            .join(" · ")}${d.rdv.length > 3 ? " …" : ""}`;
  const attentes: string[] = [];
  if (d.nbAFacturer > 0) attentes.push(pluriel(d.nbAFacturer, "intervention à facturer", "interventions à facturer"));
  if (d.nbDevisAcceptesAFacturer > 0) attentes.push(pluriel(d.nbDevisAcceptesAFacturer, "devis accepté à facturer", "devis acceptés à facturer"));
  if (d.nbDevisARelancer > 0) attentes.push(pluriel(d.nbDevisARelancer, "devis à relancer", "devis à relancer"));
  if (d.nbFacturesEnRetard > 0) attentes.push(pluriel(d.nbFacturesEnRetard, "facture en retard", "factures en retard"));
  if (d.nbTachesEnRetard > 0) attentes.push(pluriel(d.nbTachesEnRetard, "tâche en retard", "tâches en retard"));
  if (d.rdv.length === 0 && attentes.length === 0) return null;
  return {
    titre,
    corps: attentes.length > 0 ? `À faire : ${attentes.join(", ")}.` : "Rien d'autre en attente. Bonne journée !",
    url: "/dashboard",
  };
}
