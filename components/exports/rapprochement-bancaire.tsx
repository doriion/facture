"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { enregistrerPaiementsRapprochesAction } from "@/lib/actions/rapprochement";
import {
  lireReleveCsv,
  rapprocher,
  type FactureARapprocher,
  type Rapprochement,
} from "@/lib/releve-bancaire";
import { formatDateFr, formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Ligne = Rapprochement & {
  /** Facture choisie (proposée ou corrigée à la main), null = ignorer. */
  factureId: string | null;
  coche: boolean;
};

/**
 * Import d'un relevé bancaire (CSV de la banque) : les virements reçus
 * sont rapprochés des factures impayées ; on vérifie, on corrige au
 * besoin, puis les paiements sont enregistrés d'un coup. Tout se lit
 * dans le navigateur : le fichier n'est jamais envoyé au serveur.
 */
export function RapprochementBancaire({ factures }: { factures: FactureARapprocher[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function onFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    const texte = await fichier.text();
    const lecture = lireReleveCsv(texte);
    if (lecture.erreur) {
      toast.error("Relevé illisible", { description: lecture.erreur });
      return;
    }
    const resultats = rapprocher(lecture.operations, factures);
    setLignes(
      resultats.map((r) => ({
        ...r,
        factureId: r.facture?.id ?? null,
        coche: Boolean(r.facture) && !r.dejaEnregistre && r.score >= 5,
      })),
    );
    setInfo(
      `${lecture.operations.length} virement${lecture.operations.length > 1 ? "s" : ""} reçu${lecture.operations.length > 1 ? "s" : ""} dans le fichier` +
        (lecture.nbIgnorees > 0 ? ` (${lecture.nbIgnorees} ligne${lecture.nbIgnorees > 1 ? "s" : ""} ignorée${lecture.nbIgnorees > 1 ? "s" : ""} : débits, en-têtes…)` : "") +
        ".",
    );
  }

  function maj(index: number, patch: Partial<Ligne>) {
    setLignes((l) => (l ? l.map((x, i) => (i === index ? { ...x, ...patch } : x)) : l));
  }

  const aEnregistrer = (lignes ?? []).filter((l) => l.coche && l.factureId);

  async function enregistrer() {
    if (aEnregistrer.length === 0) return;
    setEnCours(true);
    try {
      const res = await enregistrerPaiementsRapprochesAction(
        aEnregistrer.map((l) => ({
          factureId: l.factureId!,
          date_paiement: l.operation.date,
          montant: l.operation.montant,
          reference: l.operation.libelle,
        })),
      );
      if (res.enregistres > 0) {
        toast.success(`${res.enregistres} paiement${res.enregistres > 1 ? "s" : ""} enregistré${res.enregistres > 1 ? "s" : ""}`, {
          description: "Les factures soldées passent en « payée ».",
        });
      }
      if (res.erreurs.length > 0) {
        toast.error(`${res.erreurs.length} paiement${res.erreurs.length > 1 ? "s" : ""} refusé${res.erreurs.length > 1 ? "s" : ""}`, {
          description: res.erreurs.slice(0, 3).join(" · "),
        });
      }
      setLignes(null);
      setInfo(null);
      router.refresh();
    } catch {
      toast.error("Enregistrement impossible", { description: "Vérifiez la connexion puis réessayez." });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-4">
      <input ref={inputRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFichier} className="hidden" />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={enCours}>
          <FileUp className="size-4" />
          Importer un relevé (CSV)
        </Button>
        <p className="text-xs text-muted-foreground">
          {factures.length === 0
            ? "Aucune facture en attente de paiement."
            : `${factures.length} facture${factures.length > 1 ? "s" : ""} en attente, ${formatEuros(factures.reduce((s, f) => s + f.reste_du, 0))} à encaisser.`}
        </p>
      </div>

      {info && <p className="text-sm text-muted-foreground">{info}</p>}

      {lignes && lignes.length > 0 && (
        <>
          <ul className="divide-y rounded-md border">
            {lignes.map((l, i) => (
              <li key={`${l.operation.ligne}`} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-primary"
                  checked={l.coche}
                  disabled={!l.factureId}
                  onChange={(e) => maj(i, { coche: e.target.checked })}
                  aria-label="Enregistrer ce paiement"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {formatEuros(l.operation.montant)}
                    <span className="font-normal text-muted-foreground"> · {formatDateFr(l.operation.date)}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={l.operation.libelle}>
                    {l.operation.libelle || "(sans libellé)"}
                  </p>
                  {l.facture && l.factureId === l.facture.id && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      {l.score >= 5 && <CheckCircle2 className="size-3.5 text-green-600" />}
                      {l.raisons.join(", ")}
                      {l.dejaEnregistre && (
                        <span className="font-medium text-amber-700 dark:text-amber-300"> · déjà enregistré, à vérifier</span>
                      )}
                    </p>
                  )}
                </div>
                <select
                  className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm sm:h-9 sm:w-72"
                  value={l.factureId ?? ""}
                  onChange={(e) => maj(i, { factureId: e.target.value || null, coche: Boolean(e.target.value) })}
                  aria-label="Facture correspondante"
                >
                  <option value="">— Ignorer (pas une facture) —</option>
                  {factures.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.numero} · {f.client_nom ?? "client"} · reste {formatEuros(f.reste_du)}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {aEnregistrer.length} paiement{aEnregistrer.length > 1 ? "s" : ""} coché{aEnregistrer.length > 1 ? "s" : ""}
              {aEnregistrer.length > 0 ? ` (${formatEuros(aEnregistrer.reduce((s, l) => s + l.operation.montant, 0))})` : ""}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setLignes(null); setInfo(null); }} disabled={enCours}>
                Annuler
              </Button>
              <Button type="button" onClick={enregistrer} disabled={enCours || aEnregistrer.length === 0}>
                {enCours ? <Loader2 className="size-4 animate-spin" /> : null}
                Enregistrer les paiements
              </Button>
            </div>
          </div>
        </>
      )}
      {lignes && lignes.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun virement reçu dans ce fichier.</p>
      )}
    </div>
  );
}
