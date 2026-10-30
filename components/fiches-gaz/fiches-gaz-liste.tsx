"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, FileCheck2, Search, Snowflake } from "lucide-react";

import type { FicheGazResume } from "@/lib/actions/fiches-gaz";
import { NATURES_COURTES, TYPES_EQUIPEMENT, type TypeEquipement } from "@/lib/fiches-gaz";
import type { NatureIntervention } from "@/lib/cerfa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateFr } from "@/lib/format";

function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Liste des fiches gaz : une carte par fiche, recherche instantanée. */
export function FichesGazListe({ fiches }: { fiches: FicheGazResume[] }) {
  const [recherche, setRecherche] = useState("");
  const filtrees = useMemo(() => {
    const q = normaliser(recherche.trim());
    if (!q) return fiches;
    return fiches.filter((f) =>
      normaliser([f.client?.nom, f.client?.ville, f.fiche_numero, f.fluide_frigo_type, f.equipement_marque, f.equipement_repere, formatDateFr(f.date_intervention)].filter(Boolean).join(" ")).includes(q),
    );
  }, [fiches, recherche]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un client, un n° de fiche, un fluide…" className="pl-9" aria-label="Rechercher une fiche" />
      </div>

      {fiches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
          <Snowflake className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Aucune fiche gaz pour l&apos;instant</p>
            <p className="text-sm text-muted-foreground">Créez la première à la mise en service d&apos;une clim ou d&apos;une pompe à chaleur : le CERFA 15497 et le bon de réception en découlent.</p>
          </div>
        </div>
      ) : filtrees.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Aucune fiche ne correspond à « {recherche} ».</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtrees.map((f) => {
            const type = f.equipement_type && f.equipement_type in TYPES_EQUIPEMENT ? TYPES_EQUIPEMENT[f.equipement_type as TypeEquipement] : null;
            const natures = f.natures_cerfa.filter((n): n is NatureIntervention => n in NATURES_COURTES).map((n) => NATURES_COURTES[n]);
            const charge = f.fluide_charge_totale_kg !== null ? `${f.fluide_charge_totale_kg.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} kg` : null;
            return (
              <li key={f.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/fiches-gaz/${f.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold hover:underline">{f.client?.nom ?? "Client à renseigner"}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatDateFr(f.date_intervention)}
                      {f.fluide_frigo_type ? ` · ${f.fluide_frigo_type}${charge ? ` ${charge}` : ""}` : ""}
                      {f.fiche_numero ? ` · n° ${f.fiche_numero}` : ""}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[type, f.equipement_marque, f.equipement_repere ? `repère ${f.equipement_repere}` : null].filter(Boolean).join(" · ") || natures.join(", ") || "Équipement à renseigner"}
                    </p>
                  </Link>
                  {f.detenteurSigne ? (
                    <Badge variant="success">Signée</Badge>
                  ) : f.signature_demandee_le ? (
                    <Badge variant="outline" className="border-amber-400 font-normal text-amber-700 dark:text-amber-300">
                      Signature demandée
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      À signer
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {f.cerfaUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={f.cerfaUrl} target="_blank" rel="noopener noreferrer">
                        <FileCheck2 className="size-4" />
                        CERFA
                      </a>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/fiches-gaz/${f.id}`}>
                        <FileCheck2 className="size-4" />
                        Générer le CERFA
                      </Link>
                    </Button>
                  )}
                  {f.bonUrl && (
                    <Button asChild variant="outline" size="sm">
                      <a href={f.bonUrl} target="_blank" rel="noopener noreferrer">
                        <ClipboardCheck className="size-4" />
                        Bon
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
