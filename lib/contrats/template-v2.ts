import { TEMPLATE_CONTRAT_V1 } from "@/lib/contrats/template-v1";
import type { TemplateContrat } from "@/lib/contrats/types";

/**
 * TEXTE DU CONTRAT D'ENTRETIEN — VERSION 2 (2026).
 *
 * SEULE DIFFÉRENCE AVEC LA VERSION 1 : à l'article 6.1, la mention de
 * franchise de TVA n'est plus écrite en dur. Elle devient l'espace
 * réservé {mentionTvaFranchise}, rempli au rendu par la valeur
 * centralisée de lib/legal-text, qui bascule de l'ancienne rédaction
 * (art. 293 B du CGI) vers la nouvelle (art. L. 223-3 du CIBS) selon
 * la date du contrat — exactement comme les devis et les factures.
 *
 * Tout le reste du contrat — les douze articles, l'annexe, les
 * conditions d'affichage — est repris tel quel depuis la version 1.
 *
 * POURQUOI UNE COPIE DÉRIVÉE PLUTÔT QU'UN FICHIER RECOPIÉ. Le texte
 * fait quatre cents lignes. Le recopier créerait deux exemplaires
 * susceptibles de diverger en silence, et obligerait à un diff pour
 * savoir ce qui a changé. En le dérivant, la modification est la seule
 * chose qu'on lit ici, et un test vérifie qu'aucun autre bloc n'a
 * bougé (template-v2.test.ts).
 *
 * RÈGLES DE CE FICHIER, IDENTIQUES À CELLES DE LA V1 :
 * - Il est FIGÉ dès qu'un contrat porte template_version = 2. Pour
 *   modifier le texte ensuite, créer template-v3.ts et déplacer
 *   TEMPLATE_VERSION_COURANTE (voir docs/contrats.md).
 * - Les contrats signés sous la version 1 gardent la version 1 : leur
 *   texte est régénéré à l'identique, indéfiniment.
 */

/**
 * Le paragraphe de la v1 que cette version remplace. Reproduit ici
 * mot pour mot : si la v1 venait à changer, la substitution échouerait
 * bruyamment au chargement plutôt que de produire un contrat faux.
 */
const PARAGRAPHE_TVA_V1 =
  "TVA non applicable, article 293 B du code général des impôts. Le prestataire relève du régime de la franchise en base de TVA : les montants indiqués sont nets de taxe et aucune TVA ne peut être récupérée par le client.";

/**
 * Le paragraphe de remplacement. La mention elle-même vient de
 * lib/legal-text au moment du rendu ; la phrase d'explication qui suit
 * est inchangée.
 */
const PARAGRAPHE_TVA_V2 =
  "{mentionTvaFranchise}. Le prestataire relève du régime de la franchise en base de TVA : les montants indiqués sont nets de taxe et aucune TVA ne peut être récupérée par le client.";

function remplacerParagrapheTva(base: TemplateContrat): TemplateContrat {
  let remplacements = 0;

  const articles = base.articles.map((article) => ({
    ...article,
    blocs: article.blocs.map((bloc) => {
      if ("texte" in bloc && bloc.texte === PARAGRAPHE_TVA_V1) {
        remplacements += 1;
        return { ...bloc, texte: PARAGRAPHE_TVA_V2 };
      }
      return bloc;
    }),
  }));

  // Ni zéro (le texte de la v1 aurait changé), ni deux ou plus (la
  // mention serait dupliquée) : le contrat serait faux dans les deux
  // cas, on refuse de le construire.
  if (remplacements !== 1) {
    throw new Error(
      `Contrat v2 : le paragraphe de TVA de la v1 devait apparaître une fois, trouvé ${remplacements} fois. Vérifier lib/contrats/template-v1.ts.`,
    );
  }

  return {
    ...base,
    version: 2,
    articles,
    annexe: { ...base.annexe, blocs: [...base.annexe.blocs] },
  };
}

export const TEMPLATE_CONTRAT_V2: TemplateContrat =
  remplacerParagrapheTva(TEMPLATE_CONTRAT_V1);
