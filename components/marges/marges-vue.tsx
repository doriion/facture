import Link from "next/link";
import { AlertCircle } from "lucide-react";

import type { MargesAnnee } from "@/lib/actions/marges";
import type { MargeChantier, MargeMois } from "@/lib/marges-agregats";
import { formatDateFr, formatEuros } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function libelleMois(ym: string): string {
  const [a, m] = ym.split("-").map(Number);
  return `${MOIS_COURTS[(m ?? 1) - 1]} ${a}`;
}

function pct(v: number | null): string {
  return v === null ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %`;
}

function couleurMarge(v: number): string {
  return v < 0 ? "text-destructive" : "";
}

/** Indicateurs de l'année, tableau des mois (cartes sur téléphone), liste des chantiers. */
export function MargesVue({ marges }: { marges: MargesAnnee }) {
  const { total, mois, chantiers } = marges;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicateur libelle="Facturé HT" valeur={formatEuros(total.totalHt)} />
        <Indicateur libelle="Achats saisis" valeur={formatEuros(total.coutRenseigne)} />
        <Indicateur
          libelle="Marge brute"
          valeur={formatEuros(total.margeEuros)}
          detail={pct(total.margePct)}
          classe={couleurMarge(total.margeEuros)}
        />
      </div>

      {total.nbLignesSansPa > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {total.nbLignesSansPa} ligne{total.nbLignesSansPa > 1 ? "s" : ""} sans prix d&apos;achat (main-d&apos;œuvre,
          ou matériel dont le coût n&apos;a pas été saisi) : la marge est calculée sans rien déduire pour elles.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Par mois</CardTitle>
          <CardDescription>Mois d&apos;émission des factures (hors brouillons et annulées, avoirs en moins).</CardDescription>
        </CardHeader>
        <CardContent>
          {mois.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune facture émise cette année.</p>
          ) : (
            <>
              <ul className="divide-y md:hidden">
                {mois.map((m) => (
                  <LigneMoisMobile key={m.mois} m={m} />
                ))}
              </ul>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mois</TableHead>
                      <TableHead className="text-right">Factures</TableHead>
                      <TableHead className="text-right">Facturé HT</TableHead>
                      <TableHead className="text-right">Achats</TableHead>
                      <TableHead className="text-right">Marge</TableHead>
                      <TableHead className="text-right">Taux</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mois.map((m) => (
                      <TableRow key={m.mois}>
                        <TableCell className="font-medium">{libelleMois(m.mois)}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.nbFactures}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEuros(m.totalHt)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatEuros(m.coutRenseigne)}</TableCell>
                        <TableCell className={`text-right font-medium tabular-nums ${couleurMarge(m.margeEuros)}`}>
                          {formatEuros(m.margeEuros)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{pct(m.margePct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Par chantier</CardTitle>
          <CardDescription>Une ligne par facture, la plus récente en premier.</CardDescription>
        </CardHeader>
        <CardContent>
          {chantiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Rien à afficher.</p>
          ) : (
            <ul className="divide-y">
              {chantiers.map((c) => (
                <LigneChantier key={c.id} c={c} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Indicateur({ libelle, valeur, detail, classe }: { libelle: string; valeur: string; detail?: string; classe?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{libelle}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${classe ?? ""}`}>
        {valeur}
        {detail && <span className="ml-2 text-sm font-normal text-muted-foreground">{detail}</span>}
      </p>
    </div>
  );
}

function LigneMoisMobile({ m }: { m: MargeMois }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div>
        <p className="font-medium">{libelleMois(m.mois)}</p>
        <p className="text-xs text-muted-foreground">
          {m.nbFactures} facture{m.nbFactures > 1 ? "s" : ""} · {formatEuros(m.totalHt)} facturés · {formatEuros(m.coutRenseigne)} d&apos;achats
        </p>
      </div>
      <div className="text-right">
        <p className={`font-semibold tabular-nums ${couleurMarge(m.margeEuros)}`}>{formatEuros(m.margeEuros)}</p>
        <p className="text-xs text-muted-foreground">{pct(m.margePct)}</p>
      </div>
    </li>
  );
}

function LigneChantier({ c }: { c: MargeChantier }) {
  return (
    <li>
      <Link href={`/factures/${c.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-accent/40">
        <div className="min-w-0">
          <p className="truncate">
            <span className="font-mono font-medium">{c.numero}</span>
            {c.avoir && <span className="ml-1 text-xs uppercase text-muted-foreground">avoir</span>}
            <span className="text-muted-foreground"> · {c.client_nom ?? "client supprimé"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateFr(c.date_emission)} · {formatEuros(c.totalHt)} HT · achats {formatEuros(c.coutRenseigne)}
            {c.nbLignesSansPa > 0 ? ` · ${c.nbLignesSansPa} ligne${c.nbLignesSansPa > 1 ? "s" : ""} sans PA` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-semibold tabular-nums ${couleurMarge(c.margeEuros)}`}>{formatEuros(c.margeEuros)}</p>
          <p className="text-xs text-muted-foreground">{pct(c.margePct)}</p>
        </div>
      </Link>
    </li>
  );
}
