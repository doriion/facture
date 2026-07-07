import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";

import { listClients } from "@/lib/actions/clients";
import { listProduits } from "@/lib/actions/produits";
import { getProfil } from "@/lib/actions/profil";
import { getDevis } from "@/lib/actions/devis";
import { buildDevisDuplicata, type DevisPrefill } from "@/lib/devis-prefill";
import { Button } from "@/components/ui/button";
import { DevisForm } from "@/components/devis/devis-form";

export const metadata = { title: "Nouveau devis — Facture AE" };

export default async function NouveauDevisPage({
  searchParams,
}: {
  searchParams: { source?: string };
}) {
  const [clients, produits, profil] = await Promise.all([
    listClients(),
    listProduits({ inclureInactifs: false }),
    getProfil(),
  ]);

  // Duplication / création depuis un modèle : ?source=<devisId> ouvre
  // le formulaire pré-rempli depuis le devis source (sans le client,
  // dates remises à aujourd'hui). Rien n'est créé — et aucun numéro
  // consommé — tant que l'utilisateur ne valide pas.
  let prefill: DevisPrefill | undefined;
  let sourceNumero: string | undefined;

  if (searchParams.source) {
    const { devis: source, lignes } = await getDevis(searchParams.source);
    if (source) {
      prefill = buildDevisDuplicata(source, lignes);
      sourceNumero = source.numero;
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/devis">
            <ArrowLeft className="size-4" />
            Retour aux devis
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Nouveau devis</h1>
        <p className="text-sm text-muted-foreground">
          Le devis sera créé en brouillon. Vous pourrez ensuite le marquer
          envoyé, télécharger le PDF, et le convertir en facture une fois
          accepté.
        </p>
      </div>

      {sourceNumero && (
        <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Copy className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            Formulaire pré-rempli depuis le devis{" "}
            <strong>{sourceNumero}</strong> (lignes, équipement, performances,
            conditions). Choisissez le client, ajustez si besoin, puis créez le
            devis.
          </p>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          <p className="mb-3">
            Vous n'avez pas encore de client. Créez-en un avant de pouvoir
            établir un devis.
          </p>
          <Button asChild>
            <Link href="/clients">Aller aux clients</Link>
          </Button>
        </div>
      ) : (
        <DevisForm
          clients={clients}
          produits={produits}
          defaultConditions={profil?.conditions_paiement_default}
          prefill={prefill}
        />
      )}
    </div>
  );
}
