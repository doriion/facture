import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Copy, UserRound, Wrench } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { listProduits } from "@/lib/actions/produits";
import { getProfil } from "@/lib/actions/profil";
import { getIntervention } from "@/lib/actions/interventions";
import { getFacture } from "@/lib/actions/factures";
import { buildFacturePrefill } from "@/lib/facture-prefill";
import { assujettiTvaEffectif } from "@/lib/tva-garde";
import { formatDateFr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FactureForm } from "@/components/factures/facture-form";
import type { Database, Json } from "@/types/database";

export const metadata = { title: "Nouvelle facture — NG Gestion" };

type Facture = Database["public"]["Tables"]["factures"]["Row"];

export default async function NouvelleFacturePage({
  searchParams,
}: {
  searchParams: { intervention?: string; source?: string };
}) {
  const [clients, produits, profil] = await Promise.all([
    listClients(),
    listProduits({ inclureInactifs: false }),
    getProfil(),
  ]);

  // Flux « Créer la facture » depuis une intervention : pré-remplissage
  // du formulaire. Rien n'est créé en base tant que l'utilisateur ne
  // valide pas — la numérotation reste manuelle.
  let prefill:
    | {
        facture: Partial<Facture>;
        lignes: Array<{
          designation: string;
          quantite: number;
          prix_unitaire_ht: number;
        }>;
      }
    | undefined;
  let interventionId: string | undefined;
  let interventionResume: string | undefined;
  let interventionSansClient = false;
  let sourceNumero: string | undefined;

  // Duplication : copie du contenu d'une facture existante, sans rien
  // créer ni numéroter tant que le formulaire n'est pas validé (un
  // brouillon dupliqué puis supprimé laissait un trou de numérotation).
  if (searchParams.source && !searchParams.intervention) {
    const { facture: source, lignes: lignesSource } = await getFacture(searchParams.source);
    if (source) {
      prefill = {
        facture: {
          client_id: source.client_id,
          type_activite: source.type_activite,
          conditions_paiement: source.conditions_paiement,
          adresse_chantier: source.adresse_chantier,
          notes: source.notes,
          equipement_info: source.equipement_info,
          aides_financieres: source.aides_financieres,
        },
        lignes: lignesSource.map((l) => ({
          designation: l.designation,
          quantite: Number(l.quantite),
          prix_unitaire_ht: Number(l.prix_unitaire_ht),
          nature_fiscale: l.nature_fiscale,
          type: l.type,
          prix_achat_ttc_unitaire: l.prix_achat_ttc_unitaire,
          fournisseur: l.fournisseur,
        })),
      };
      sourceNumero = source.numero;
    }
  }

  if (searchParams.intervention) {
    const { intervention, client } = await getIntervention(
      searchParams.intervention,
    );
    // Intervention déjà facturée : on renvoie vers la facture existante
    // plutôt que de risquer une double facturation.
    if (intervention?.facture_id) {
      redirect(`/factures/${intervention.facture_id}`);
    }
    if (intervention && !intervention.supprime_le) {
      const p = buildFacturePrefill(intervention);
      prefill = {
        facture: {
          client_id: p.client_id,
          type_activite: p.type_activite,
          date_prestation: p.date_prestation,
          date_prestation_fin: p.date_prestation_fin || null,
          equipement_info: p.equipement_info as Json,
        },
        lignes: p.lignes,
      };
      interventionId = intervention.id;
      interventionResume = `intervention du ${formatDateFr(intervention.date_intervention)}${
        client ? ` — ${client.nom}` : ""
      }`;
      // Intervention posée sans client : la facture en exige un ; le
      // client choisi ici sera reporté sur l'intervention à la création.
      interventionSansClient = !intervention.client_id;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/factures">
            <ArrowLeft className="size-4" />
            Retour aux factures
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Nouvelle facture</h1>
        <p className="text-sm text-muted-foreground">
          La facture sera créée en brouillon. Vous pourrez ensuite la marquer
          envoyée et générer le PDF.
        </p>
      </div>

      {sourceNumero && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Copy className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Copie de la facture <strong>{sourceNumero}</strong> : dates du
            jour, contenu repris. Rien n&apos;est créé ni numéroté tant que
            vous ne validez pas.
          </p>
        </div>
      )}

      {interventionResume && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Wrench className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Formulaire pré-rempli depuis l&apos;{interventionResume}. Vérifiez
            les lignes et les montants avant de créer la facture —
            l&apos;intervention sera automatiquement marquée comme facturée.
          </p>
        </div>
      )}

      {interventionSansClient && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-100">
          <UserRound className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Client à renseigner :</strong> cette intervention n&apos;a
            pas encore de client. Choisissez-le ci-dessous — il sera aussi
            rattaché à l&apos;intervention.
          </p>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <p className="mb-3">
            Vous n'avez pas encore de client. Créez-en un avant de pouvoir
            facturer.
          </p>
          <Button asChild>
            <Link href="/clients">Aller aux clients</Link>
          </Button>
        </div>
      ) : (
        <FactureForm
          clients={clients}
          produits={produits}
          defaultConditionsPaiement={profil?.conditions_paiement_default}
          prefill={prefill}
          interventionId={interventionId}
          assujettiTva={assujettiTvaEffectif(profil, null)}
        />
      )}
    </div>
  );
}
