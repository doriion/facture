import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { listProduits } from "@/lib/actions/produits";
import { getFacture, listFactureEnfants } from "@/lib/actions/factures";
import { getProfil } from "@/lib/actions/profil";
import { getFacturePaiements } from "@/lib/actions/paiements";
import { aujourdhuiParis } from "@/lib/dates";
import {
  estFactureVentilee,
  LABELS_MODE_AVOIR,
  statutAffichageFacture,
  TYPE_AVOIR,
  type ModeAvoir,
} from "@/lib/factures-transitions";
import {
  getAvailableEventsForFacture,
  getFactureCoveredEvents,
} from "@/lib/actions/facture-events-couverts";
import { AjouterTacheButton } from "@/components/taches/ajouter-tache-button";
import { FactureForm } from "@/components/factures/facture-form";
import { FacturePaiements } from "@/components/factures/facture-paiements";
import { FactureAcompteSolde } from "@/components/factures/facture-acompte-solde";
import { FactureEventsCouverts } from "@/components/factures/facture-events-couverts";
import { FactureActions } from "@/components/factures/facture-actions";
import { CreerAvoirDialog } from "@/components/factures/creer-avoir-dialog";
import { ActionsFiche } from "@/components/actions-fiche";
import { StatutBadge } from "@/components/factures/statut-badge";
import { Button } from "@/components/ui/button";
import { formatDateFr, formatEuros } from "@/lib/format";
import {
  assujettiTvaEffectif,
  documentEmis,
  explicationMoteurTva,
} from "@/lib/tva-garde";
import type { StatutFacture } from "@/lib/validations/facture";

export const metadata = { title: "Édition facture — NG Gestion" };

type Facture = NonNullable<Awaited<ReturnType<typeof getFacture>>["facture"]>;
type Enfant = Awaited<ReturnType<typeof listFactureEnfants>>[number];

export default async function EditFacturePage({
  params,
}: {
  params: { id: string };
}) {
  const { facture, lignes, client } = await getFacture(params.id);
  if (!facture) notFound();

  const [
    clients,
    produits,
    profil,
    paiementsSummary,
    enfants,
    available,
    coveredCurrent,
  ] = await Promise.all([
    listClients(),
    listProduits({ inclureInactifs: false }),
    getProfil(),
    getFacturePaiements(params.id),
    listFactureEnfants(params.id),
    getAvailableEventsForFacture({
      factureId: params.id,
      centerDate: facture.date_emission,
    }),
    getFactureCoveredEvents(params.id),
  ]);

  const isLocked = facture.statut === "annulee";
  const avoir = facture.type_facture === TYPE_AVOIR;
  // Facture d'origine d'un avoir (mention obligatoire, lien de retour).
  const parent =
    avoir && facture.facture_parent_id
      ? (await getFacture(facture.facture_parent_id)).facture
      : null;
  const avoirs = enfants.filter((e) => e.type_facture === TYPE_AVOIR);
  // Statut AFFICHÉ (« retard », « ventilée », « avoir émis »…) : même
  // règle que la liste, la fiche contredisait la liste sur une facture échue.
  const ventilee = estFactureVentilee(facture, enfants);
  const statutAffiche = statutAffichageFacture(facture, aujourdhuiParis(), { ventilee });
  // Un avoir se crée sur une facture émise (envoyée ou payée), non
  // ventilée, qui n'est pas elle-même un avoir.
  const peutCreerAvoir =
    !avoir && !isLocked && !ventilee && (facture.statut === "envoyee" || facture.statut === "payee");
  // Libellés « HT » figés avec le document (snapshot émetteur).
  const assujettiTva = assujettiTvaEffectif(profil, facture.emetteur);
  // Garde TVA : la route PDF répond 501, mais un `<a download>` avale le
  // corps de la réponse — on explique donc côté page.
  const pdfBloqueMotif = assujettiTva
    ? explicationMoteurTva(documentEmis(facture.emetteur))
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/factures">
            <ArrowLeft className="size-4" />
            Retour aux factures
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-bold tracking-tight">
                {facture.numero}
              </h1>
              <StatutBadge statut={statutAffiche} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {avoir ? "Émis" : "Émise"} le {formatDateFr(facture.date_emission)} —{" "}
              {client?.nom ?? "Client inconnu"} —{" "}
              <span className="font-medium text-foreground">
                {avoir ? "avoir de " : ""}
                {formatEuros(Number(facture.total_ht))}
              </span>
            </p>
          </div>
          <ActionsFiche>
            {!avoir && (
              <AjouterTacheButton
                lienLabel={`Facture ${facture.numero}`}
                titre={`Relancer la facture ${facture.numero}`}
                factureId={facture.id}
              />
            )}
            {peutCreerAvoir && (
              <CreerAvoirDialog
                factureId={facture.id}
                numero={facture.numero}
                totalFacture={paiementsSummary.total_facture}
                totalEncaisse={paiementsSummary.total_encaisse}
                avoirsImputes={paiementsSummary.total_avoirs_imputes}
                avoirsRembourses={paiementsSummary.total_avoirs_rembourses}
              />
            )}
            <FactureActions
              factureId={facture.id}
              numero={facture.numero}
              statut={facture.statut as StatutFacture}
              ventilee={ventilee}
              typeFacture={facture.type_facture}
              modeAvoir={facture.mode_avoir}
              clientEmail={client?.email ?? null}
              clientNom={client?.nom ?? "le client"}
              pdfBloqueMotif={pdfBloqueMotif}
            />
          </ActionsFiche>
        </div>
      </div>

      {avoir && <BandeauAvoir facture={facture} parent={parent} />}

      {!avoir && avoirs.length > 0 && (
        <ListeAvoirs avoirs={avoirs} imputes={paiementsSummary.total_avoirs_imputes} />
      )}

      {ventilee && !isLocked && (
        <div className="rounded-md border-l-4 border-slate-400 bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/40">
          <p className="font-medium">Facture d&apos;origine ventilée en acompte(s) et solde</p>
          <p className="mt-1 text-muted-foreground">
            Ce sont les factures d&apos;acompte et de solde ci-dessous qui
            s&apos;envoient et s&apos;encaissent. Celle-ci ne compte ni dans le
            facturé ni dans l&apos;impayé, pour ne pas compter le montant deux fois.
          </p>
        </div>
      )}

      {/* Bandeau si acompte ou solde */}
      {(facture as { type_facture?: string }).type_facture === "acompte" && (
        <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            📋 Facture d'acompte
            {(facture as { pourcentage_acompte?: number | null })
              .pourcentage_acompte
              ? ` (${(facture as { pourcentage_acompte?: number | null }).pourcentage_acompte}%)`
              : ""}
          </p>
        </div>
      )}
      {(facture as { type_facture?: string }).type_facture === "solde" && (
        <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm dark:bg-emerald-950/30">
          <p className="font-medium text-emerald-900 dark:text-emerald-100">
            ✅ Facture de solde — déduction faite des acomptes
          </p>
        </div>
      )}

      {isLocked ? (
        <div className="rounded-lg border-l-4 border-rose-500 bg-rose-50 p-4 text-sm dark:bg-rose-950/30">
          <p className="font-medium text-rose-900 dark:text-rose-100">
            ⊘ {avoir ? "Avoir annulé" : "Facture annulée"}
            {facture.date_annulation && (
              <> le {formatDateFr(facture.date_annulation)}</>
            )}
          </p>
          {facture.motif_annulation && (
            <p className="mt-1 text-rose-800 dark:text-rose-200">
              <strong>Motif :</strong> {facture.motif_annulation}
            </p>
          )}
          <p className="mt-2 text-xs text-rose-700/80 dark:text-rose-300/80">
            Le numéro <strong>{facture.numero}</strong> reste réservé en base
            pour la traçabilité fiscale. Pour modifier le contenu, restaurez
            d'abord en brouillon.
          </p>
        </div>
      ) : (
        <FactureForm
          clients={clients}
          produits={produits}
          facture={facture}
          lignes={lignes}
          defaultConditionsPaiement={profil?.conditions_paiement_default}
          assujettiTva={assujettiTva}
          verrouillee={facture.statut !== "brouillon"}
          avoir={avoir}
        />
      )}

      {/* Paiements : encaissements d'une facture, ou remboursement d'un
          avoir de remboursement (un avoir imputé n'a rien à encaisser). */}
      {!isLocked &&
        facture.statut !== "brouillon" &&
        (!avoir || facture.mode_avoir === "remboursement") && (
          <FacturePaiements
            factureId={facture.id}
            summary={paiementsSummary}
            remboursement={avoir}
          />
        )}

      {/* Acompte/solde uniquement sur les factures normales (pas
          acomptes ni soldes eux-mêmes) et avec au moins une ligne. */}
      {!isLocked &&
        (facture as { type_facture?: string }).type_facture === "normale" &&
        Number(facture.total_ht) > 0 && (
          <FactureAcompteSolde
            factureId={facture.id}
            totalParent={Number(facture.total_ht)}
            enfants={enfants}
            assujettiTva={assujettiTva}
          />
        )}

      {!isLocked && !avoir && (
        <FactureEventsCouverts
          factureId={facture.id}
          interventions={available.interventions}
          externals={available.externals}
          initialInterventionIds={coveredCurrent.interventionIds}
          initialExternalUids={coveredCurrent.externalUids}
        />
      )}
    </div>
  );
}

function BandeauAvoir({ facture, parent }: { facture: Facture; parent: Facture | null }) {
  const mode = facture.mode_avoir as ModeAvoir | null;
  return (
    <div className="rounded-md border-l-4 border-violet-500 bg-violet-50 px-4 py-3 text-sm dark:bg-violet-950/30">
      <p className="font-medium text-violet-900 dark:text-violet-100">
        Avoir sur la facture{" "}
        {parent ? (
          <Link href={`/factures/${parent.id}`} className="font-mono underline">
            {parent.numero}
          </Link>
        ) : (
          "d'origine"
        )}
        {parent ? ` du ${formatDateFr(parent.date_emission)}` : ""}
      </p>
      <p className="mt-1 text-violet-900/80 dark:text-violet-200/80">
        {mode ? LABELS_MODE_AVOIR[mode] : ""}
        {facture.motif_avoir ? ` — Motif : ${facture.motif_avoir}` : ""}
      </p>
      {facture.statut === "brouillon" && (
        <p className="mt-1 text-xs text-violet-900/70 dark:text-violet-200/70">
          Brouillon : vérifiez les lignes, puis « Émettre l&apos;avoir ». Le
          montant doit rester dans le plafond de son mode.
        </p>
      )}
    </div>
  );
}

function ListeAvoirs({ avoirs, imputes }: { avoirs: Enfant[]; imputes: number }) {
  return (
    <div className="rounded-md border-l-4 border-violet-500 bg-violet-50 px-4 py-3 text-sm dark:bg-violet-950/30">
      <p className="font-medium text-violet-900 dark:text-violet-100">
        {avoirs.length > 1 ? "Avoirs émis sur cette facture" : "Avoir émis sur cette facture"}
        {imputes > 0 ? ` — ${formatEuros(imputes)} imputés, déduits du reste dû` : ""}
      </p>
      <ul className="mt-1 space-y-0.5">
        {avoirs.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2">
            <Link href={`/factures/${a.id}`} className="font-mono underline">
              {a.numero}
            </Link>
            <span>{formatEuros(Number(a.total_ht))}</span>
            <StatutBadge
              statut={statutAffichageFacture(
                { statut: a.statut, type_facture: a.type_facture, mode_avoir: a.mode_avoir },
                aujourdhuiParis(),
              )}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
