"use client";

import { useMemo, useState } from "react";
import { Check, MapPin } from "lucide-react";

import {
  GROUPES_BAREME,
  calculerEntretien,
  coutZone,
  libelleTranche,
  trierTranches,
  type BaremeEntretien,
  type GroupeBareme,
  type ResultatCalcul,
} from "@/lib/bareme-entretien";
import { formatEuros } from "@/lib/format";
import { mentionTvaFranchise } from "@/lib/legal-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AUCUNE_ZONE = "__aucune__";

/**
 * Calculateur d'entretien : on saisit le nombre d'unités par poste et
 * la zone de déplacement, le chiffrage se met à jour en direct (tranche
 * atteinte, prix unitaire, total). Tout le calcul vient de
 * lib/bareme-entretien (pur, testé) — ici, uniquement de la saisie et
 * de l'affichage. Montants NETS : aucune TVA, nulle part.
 *
 * `onValider` (optionnel) : bouton de report du résultat dans un devis
 * ou un contrat. Sans lui, le calculateur sert à chiffrer vite.
 */
export function CalculateurEntretien({
  bareme,
  onValider,
  libelleValider = "Utiliser ce chiffrage",
}: {
  bareme: BaremeEntretien;
  onValider?: (calcul: ResultatCalcul) => void;
  libelleValider?: string;
}) {
  const [quantites, setQuantites] = useState<Record<string, string>>({});
  const [zoneCode, setZoneCode] = useState<string>(AUCUNE_ZONE);

  const calcul = useMemo(
    () =>
      calculerEntretien(bareme, {
        quantites: Object.fromEntries(
          Object.entries(quantites).map(([code, v]) => [code, Number(v) || 0]),
        ),
        zoneCode: zoneCode === AUCUNE_ZONE ? null : zoneCode,
      }),
    [bareme, quantites, zoneCode],
  );

  const groupes = (Object.keys(GROUPES_BAREME) as GroupeBareme[])
    .map((g) => ({
      groupe: g,
      postes: bareme.postes.filter((p) => p.actif && p.groupe === g),
    }))
    .filter((g) => g.postes.length > 0);
  const zones = bareme.zones.filter((z) => z.actif);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* min-w-0 : sans lui, les libellés de tranches (« 1 : 199 € · 2 à
          5 : 146 € … ») élargissaient la colonne au-delà de l'écran du
          téléphone (défilement horizontal) au lieu d'être tronqués. */}
      <div className="min-w-0 space-y-5">
        {groupes.map(({ groupe, postes }) => (
          <section key={groupe} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {GROUPES_BAREME[groupe]}
            </h3>
            <div className="divide-y rounded-md border">
              {postes.map((p) => {
                const tranches = trierTranches(p.tranches);
                const ligne = calcul.lignes.find((l) => l.code === p.code);
                return (
                  <div
                    key={p.code}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`qte-${p.code}`} className="block truncate text-sm font-medium">
                        {p.libelle}
                      </Label>
                      <p className="truncate text-xs text-muted-foreground">
                        {tranches
                          .map((t, i) => `${libelleTranche(tranches, i)} : ${formatEuros(t.prix)}`)
                          .join(" · ")}
                        {p.unite !== "unité" ? ` / ${p.unite}` : ""}
                      </p>
                    </div>
                    <Input
                      id={`qte-${p.code}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="0"
                      className="w-16 text-right"
                      value={quantites[p.code] ?? ""}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        setQuantites((q) => ({
                          ...q,
                          [p.code]: e.target.value.replace(/[^0-9]/g, ""),
                        }))
                      }
                    />
                    <div className="w-24 text-right text-sm tabular-nums">
                      {ligne ? (
                        <>
                          <span className="font-medium">{formatEuros(ligne.total)}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {ligne.quantite} × {formatEuros(ligne.prixUnitaire)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Déplacement
          </h3>
          <Select value={zoneCode} onValueChange={setZoneCode}>
            <SelectTrigger className="w-full sm:w-80">
              <MapPin className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUNE_ZONE}>Aucun déplacement facturé</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z.code} value={z.code}>
                  {z.libelle} — {formatEuros(coutZone(z, bareme.reglages).total)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {calcul.deplacement && (
            <p className="text-xs text-muted-foreground">
              {calcul.deplacement.zone.distance_km} km × {formatEuros(bareme.reglages.tarif_km)}{" "}
              = {formatEuros(calcul.deplacement.detail.kilometrage)}
              {calcul.deplacement.zone.peage > 0 && (
                <> + péage {formatEuros(calcul.deplacement.detail.peage)}</>
              )}
              {" "}+ {calcul.deplacement.zone.temps_route_h} h × {formatEuros(bareme.reglages.taux_horaire)}{" "}
              = {formatEuros(calcul.deplacement.detail.tempsRoute)}
            </p>
          )}
        </section>
      </div>

      {/* Total toujours visible sur le téléphone : le récapitulatif
          est sous la liste, on voit le montant changer en saisissant. */}
      {(calcul.lignes.length > 0 || calcul.deplacement) && (
        <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 flex items-baseline justify-between border-t bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
          <span className="text-sm font-medium">Total net</span>
          <span className="text-lg font-bold tabular-nums text-primary">
            {formatEuros(calcul.total)}
          </span>
        </div>
      )}

      {/* Récapitulatif */}
      <aside className="h-fit space-y-3 rounded-lg border bg-muted/30 p-4 lg:sticky lg:top-4">
        <h3 className="text-sm font-semibold">Chiffrage</h3>
        {calcul.lignes.length === 0 && !calcul.deplacement ? (
          <p className="text-sm text-muted-foreground">
            Indiquez le nombre d&apos;unités par équipement.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {calcul.lignes.map((l) => (
              <li key={l.code} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  {l.quantite} × {l.libelle}
                </span>
                <span className="shrink-0 tabular-nums">{formatEuros(l.total)}</span>
              </li>
            ))}
            {calcul.deplacement && (
              <li className="flex justify-between gap-3">
                <span className="min-w-0 truncate">
                  Déplacement {calcul.deplacement.zone.libelle}
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatEuros(calcul.deplacement.detail.total)}
                </span>
              </li>
            )}
          </ul>
        )}
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-sm font-medium">Total net</span>
          <span className="text-xl font-bold tabular-nums text-primary">
            {formatEuros(calcul.total)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Montants nets — {mentionTvaFranchise()}. Aucune TVA ajoutée.
        </p>
        {onValider && (
          <Button
            type="button"
            className="w-full"
            disabled={calcul.lignes.length === 0 && !calcul.deplacement}
            onClick={() => onValider(calcul)}
          >
            <Check className="size-4" />
            {libelleValider}
          </Button>
        )}
      </aside>
    </div>
  );
}
