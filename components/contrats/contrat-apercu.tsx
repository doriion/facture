import { formatDateFr, formatEuros } from "@/lib/format";
import {
  blocsVisibles,
  blocVisible,
  getTemplateContrat,
  netAPayer,
  remplirTexte,
  LABELS_QUALITE,
  type ContexteAffichage,
} from "@/lib/contrats/logic";
import {
  adresseAffichagePrestataire,
  equipementsDe,
  nomAffichagePrestataire,
  valeursTemplate,
  type ClientSnapshot,
  type ContratRow,
  type PrestataireSnapshot,
} from "@/lib/contrats/rendu";
import type { BlocContrat } from "@/lib/contrats/types";

/**
 * Rendu HTML complet du contrat — partagé entre l'aperçu admin et la
 * page publique de signature (le PDF a son propre rendu, même texte).
 * Composant serveur-compatible : aucune interactivité.
 */
export function ContratApercu({
  contrat,
  prestataire,
  clientSnapshot,
}: {
  contrat: ContratRow;
  prestataire: PrestataireSnapshot;
  /** Coordonnées client connues (snapshot figé, ou pré-remplies) */
  clientSnapshot: ClientSnapshot;
}) {
  const template = getTemplateContrat(contrat.template_version);
  const ctx: ContexteAffichage = {
    qualiteClient:
      contrat.qualite_client === "professionnel"
        ? "professionnel"
        : "particulier",
    modeConclusion:
      contrat.mode_conclusion === "presentiel"
        ? "presentiel"
        : contrat.mode_conclusion === "hors_etablissement"
          ? "hors_etablissement"
          : "distance",
  };
  const valeurs = valeursTemplate({ contrat, prestataire });
  const equipements = equipementsDe(contrat);
  const net = netAPayer(Number(contrat.redevance), Number(contrat.remise));

  const renderBloc = (bloc: BlocContrat, i: number) => {
    switch (bloc.kind) {
      case "h3":
        return (
          <h4 key={i} className="mt-3 text-sm font-semibold">
            {remplirTexte(bloc.texte, valeurs)}
          </h4>
        );
      case "p":
        return (
          <p key={i} className="mt-2 text-sm leading-relaxed">
            {remplirTexte(bloc.texte, valeurs)}
          </p>
        );
      case "note":
        return (
          <p key={i} className="mt-2 text-xs italic text-muted-foreground">
            {remplirTexte(bloc.texte, valeurs)}
          </p>
        );
      case "formule":
        return (
          <p key={i} className="mt-2 text-center text-sm font-medium">
            {bloc.texte}
          </p>
        );
      case "li":
        return (
          <ul key={i} className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {bloc.items.map((item, j) => (
              <li key={j}>{remplirTexte(item, valeurs)}</li>
            ))}
          </ul>
        );
      case "table-equipements":
        return (
          <div key={i} className="mt-2 overflow-x-auto">
            <table className="w-full border text-xs">
              <thead>
                <tr className="bg-muted/60 text-left">
                  <th className="border px-2 py-1.5">Type d'équipement</th>
                  <th className="border px-2 py-1.5">Marque / Modèle</th>
                  <th className="border px-2 py-1.5">N° de série</th>
                  <th className="border px-2 py-1.5">Puissance (kW)</th>
                  <th className="border px-2 py-1.5">Fluide / charge</th>
                </tr>
              </thead>
              <tbody>
                {equipements.map((e, j) => (
                  <tr key={j}>
                    <td className="border px-2 py-1.5">{e.type}</td>
                    <td className="border px-2 py-1.5">{e.marque_modele}</td>
                    <td className="border px-2 py-1.5">{e.num_serie}</td>
                    <td className="border px-2 py-1.5">{e.puissance_kw}</td>
                    <td className="border px-2 py-1.5">{e.fluide_charge}</td>
                  </tr>
                ))}
                {equipements.length === 0 && (
                  <tr>
                    <td
                      className="border px-2 py-3 text-center text-muted-foreground"
                      colSpan={5}
                    >
                      Aucun équipement renseigné
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      case "table-prix":
        return (
          <div key={i} className="mt-2 overflow-x-auto">
            <table className="w-full max-w-md border text-sm">
              <tbody>
                <tr>
                  <td className="border px-2 py-1.5">
                    Redevance annuelle forfaitaire (net)
                  </td>
                  <td className="border px-2 py-1.5 text-right">
                    {formatEuros(Number(contrat.redevance))}
                  </td>
                </tr>
                <tr>
                  <td className="border px-2 py-1.5">
                    Remise éventuelle (client installé par le prestataire, etc.)
                  </td>
                  <td className="border px-2 py-1.5 text-right">
                    {Number(contrat.remise) > 0
                      ? `− ${formatEuros(Number(contrat.remise))}`
                      : "—"}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td className="border px-2 py-1.5">
                    NET À PAYER PAR VISITE ANNUELLE
                  </td>
                  <td className="border px-2 py-1.5 text-right">
                    {formatEuros(net)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête : titre + parties */}
      <div className="text-center">
        <h2 className="text-lg font-bold tracking-tight">{template.titre}</h2>
        <p className="text-sm text-muted-foreground">{template.sousTitre}</p>
        <p className="mt-1 text-sm">
          Contrat n°{" "}
          <span className="font-mono font-medium">
            {contrat.numero ?? "(attribué à l'envoi)"}
          </span>
        </p>
      </div>

      <p className="text-sm font-medium">Entre les soussignés :</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Le prestataire
          </p>
          <p className="mt-1 font-medium">
            {nomAffichagePrestataire(prestataire)}
          </p>
          <p>Entreprise individuelle — plomberie, chauffage, climatisation</p>
          <p>{adresseAffichagePrestataire(prestataire) || "……"}</p>
          <p>
            SIRET {prestataire.siret ?? "……"} — APE{" "}
            {prestataire.code_ape ?? "……"}
          </p>
          {prestataire.telephone && <p>Tél. : {prestataire.telephone}</p>}
          {prestataire.email_pro && <p>{prestataire.email_pro}</p>}
        </div>
        <div className="rounded-md border p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Le client
          </p>
          <p className="mt-1 font-medium">
            {clientSnapshot.raison_sociale || clientSnapshot.nom || "……"}
          </p>
          <p className="whitespace-pre-line">
            {clientSnapshot.adresse || "Adresse : ……"}
          </p>
          <p>Tél. : {clientSnapshot.telephone || "……"}</p>
          <p>E-mail : {clientSnapshot.email || "……"}</p>
          {contrat.qualite_client === "professionnel" && (
            <p>SIRET : {clientSnapshot.siret || "……"}</p>
          )}
          <p className="mt-1.5">
            Qualité :{" "}
            {LABELS_QUALITE[
              contrat.qualite_client as keyof typeof LABELS_QUALITE
            ] ?? contrat.qualite_client}
          </p>
          {contrat.occupant && (
            <p>
              Occupant :{" "}
              {contrat.occupant === "proprietaire"
                ? "Propriétaire"
                : "Locataire"}
            </p>
          )}
          {contrat.contact_site && (
            <p>Contact sur site : {contrat.contact_site}</p>
          )}
        </div>
      </div>

      {contrat.adresse_site && (
        <div className="rounded-md border p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Adresse du site d'intervention (si différente)
          </p>
          <p className="mt-1 whitespace-pre-line">{contrat.adresse_site}</p>
        </div>
      )}

      <p className="text-sm font-medium">{template.preambule}</p>

      {template.articles.map((article) => {
        const blocs = blocsVisibles(article.blocs, ctx);
        if (blocs.length === 0) return null;
        return (
          <section key={article.numero}>
            <h3 className="mt-4 border-b pb-1 text-sm font-bold uppercase tracking-wide">
              Article {article.numero} — {article.titre}
            </h3>
            {blocs.map(renderBloc)}
          </section>
        );
      })}

      {blocVisible(template.annexe.visible, ctx) && (
        <section className="rounded-md border border-dashed p-3">
          <h3 className="text-sm font-bold uppercase tracking-wide">
            {template.annexe.titre}
          </h3>
          {template.annexe.blocs.map(renderBloc)}
        </section>
      )}

      {contrat.date_effet && (
        <p className="text-xs text-muted-foreground">
          Date d'effet : {formatDateFr(contrat.date_effet)} — échéance
          annuelle : {formatDateFr(contrat.date_echeance)}
        </p>
      )}
    </div>
  );
}
