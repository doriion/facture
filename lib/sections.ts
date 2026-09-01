/**
 * Sections et sous-totaux des lignes de devis/factures — helpers PURS.
 *
 * Une ligne de type "titre" ouvre une section (ex. « MATÉRIEL »,
 * « MAIN-D'ŒUVRE ») ; les lignes qui suivent lui appartiennent jusqu'au
 * titre suivant. Le PDF affiche un sous-total par section titrée, puis
 * le total général (somme des seules lignes normales — les titres ne
 * portent ni quantité ni prix).
 */

export type LigneSectionInput = {
  designation: string;
  total_ht: number;
  /** 'ligne' (défaut) ou 'titre' */
  type?: string | null;
};

export type Section<L extends LigneSectionInput> = {
  /** null = lignes situées avant le premier titre */
  titre: string | null;
  lignes: L[];
  sousTotal: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function estTitre(l: { type?: string | null }): boolean {
  return l.type === "titre";
}

/**
 * Découpe les lignes en sections. `hasSections` est vrai dès qu'un
 * titre existe — c'est lui qui déclenche l'affichage des sous-totaux
 * (un document sans titre garde son rendu d'avant, inchangé).
 */
export function computeSections<L extends LigneSectionInput>(
  lignes: L[],
): { sections: Section<L>[]; hasSections: boolean } {
  const sections: Section<L>[] = [];
  let courante: Section<L> | null = null;

  for (const l of lignes) {
    if (estTitre(l)) {
      courante = { titre: l.designation, lignes: [], sousTotal: 0 };
      sections.push(courante);
      continue;
    }
    if (!courante) {
      courante = { titre: null, lignes: [], sousTotal: 0 };
      sections.push(courante);
    }
    courante.lignes.push(l);
    courante.sousTotal = round2(courante.sousTotal + Number(l.total_ht));
  }

  return {
    sections,
    hasSections: sections.some((s) => s.titre !== null),
  };
}

/** Total général : somme des lignes normales (les titres comptent 0). */
export function totalLignes(lignes: LigneSectionInput[]): number {
  return round2(
    lignes
      .filter((l) => !estTitre(l))
      .reduce((sum, l) => sum + Number(l.total_ht), 0),
  );
}

/**
 * Détecte la présence de matériel dans un document : une ligne classée
 * « BIC ventes » (revente sans pose) OU une section dont le titre
 * évoque le matériel/fournitures. Sert au bandeau informatif du
 * FORMULAIRE (activité mixte en micro) — jamais bloquant, jamais sur
 * le PDF.
 */
export function contientMateriel(
  lignes: Array<{
    designation?: string | null;
    type?: string | null;
    nature_fiscale?: string | null;
  }>,
): boolean {
  return lignes.some((l) => {
    if (!estTitre(l) && l.nature_fiscale === "bic_ventes") return true;
    if (estTitre(l)) {
      const t = (l.designation ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return t.includes("materiel") || t.includes("fourniture");
    }
    return false;
  });
}
