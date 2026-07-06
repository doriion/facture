import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEuros } from "@/lib/format";
import {
  PLAFOND_MICRO_SERVICES,
  SEUIL_FRANCHISE_TVA,
  SEUIL_FRANCHISE_TVA_MAJORE,
  niveauAlerte,
  pourcentageSeuil,
  type NiveauAlerte,
} from "@/lib/seuils-micro";

/**
 * Jauges des seuils micro-entreprise — CRITIQUES pour un auto-entrepreneur :
 * 1. Franchise en base de TVA (dépassée → facturer la TVA)
 * 2. Plafond du régime micro (dépassé 2 ans de suite → sortie du régime)
 *
 * Base de calcul : CA ENCAISSÉ de l'année (encaissements, comme la
 * déclaration URSSAF), pas les factures émises.
 *
 * Alerte visuelle : vert < 80 %, amber ≥ 80 %, orange ≥ 90 %, rouge ≥ 100 %.
 */

const COLORS: Record<
  NiveauAlerte,
  { bar: string; text: string }
> = {
  ok: { bar: "bg-primary", text: "text-primary" },
  warn: { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  danger: {
    bar: "bg-orange-500",
    text: "text-orange-700 dark:text-orange-300",
  },
  critical: { bar: "bg-destructive", text: "text-destructive" },
};

function Jauge({
  titre,
  sousTitre,
  ca,
  seuil,
  messages,
}: {
  titre: string;
  sousTitre: string;
  ca: number;
  seuil: number;
  messages: Record<NiveauAlerte, string>;
}) {
  const pct = pourcentageSeuil(ca, seuil);
  const tone = niveauAlerte(pct);
  const c = COLORS[tone];

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{titre}</p>
          <p className="text-xs text-muted-foreground">{sousTitre}</p>
        </div>
        <p className={`text-xl font-bold tabular-nums ${c.text}`}>{pct}%</p>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${c.bar}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
        {/* Repères 80 % et 90 % */}
        <div className="absolute left-[80%] top-0 h-full w-px bg-foreground/30" />
        <div className="absolute left-[90%] top-0 h-full w-px bg-foreground/30" />
      </div>

      <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>0</span>
        <span>80% ({formatEuros(seuil * 0.8)})</span>
        <span>90%</span>
        <span>{formatEuros(seuil)}</span>
      </div>

      <p
        className={
          tone === "ok"
            ? "text-sm text-muted-foreground"
            : `text-sm font-medium ${c.text}`
        }
      >
        {messages[tone]}
      </p>
    </div>
  );
}

export function SeuilsMicroCard({
  caEncaisseAnnee,
  annee,
}: {
  caEncaisseAnnee: number;
  annee: number;
}) {
  const pctTva = pourcentageSeuil(caEncaisseAnnee, SEUIL_FRANCHISE_TVA);
  const pctMicro = pourcentageSeuil(caEncaisseAnnee, PLAFOND_MICRO_SERVICES);
  const pire = niveauAlerte(Math.max(pctTva, pctMicro));

  const Icon =
    pire === "critical" ? ShieldAlert : pire === "ok" ? Info : AlertTriangle;

  const cadres: Record<NiveauAlerte, string> = {
    ok: "border-primary/30 bg-primary/5",
    warn: "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    danger:
      "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
    critical: "border-destructive/40 bg-destructive/10",
  };

  const resteTva = Math.max(0, SEUIL_FRANCHISE_TVA - caEncaisseAnnee);
  const resteMicro = Math.max(0, PLAFOND_MICRO_SERVICES - caEncaisseAnnee);

  return (
    <Card className={cadres[pire]}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Icon className={`size-5 shrink-0 ${COLORS[pire].text}`} />
          <div className="flex-1">
            <CardTitle className="text-base">
              Seuils micro-entreprise — {annee}
            </CardTitle>
            <CardDescription>
              CA encaissé {annee} :{" "}
              <strong className="text-foreground">
                {formatEuros(caEncaisseAnnee)}
              </strong>{" "}
              · base encaissements, comme la déclaration URSSAF
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Jauge
          titre="Franchise en base de TVA"
          sousTitre={`Art. L.223-3 CIBS · prestations de services · seuil majoré ${formatEuros(SEUIL_FRANCHISE_TVA_MAJORE)}`}
          ca={caEncaisseAnnee}
          seuil={SEUIL_FRANCHISE_TVA}
          messages={{
            ok: `Il reste ${formatEuros(resteTva)} avant le seuil de franchise TVA.`,
            warn: `⚠ 80 % du seuil de franchise TVA atteint — il reste ${formatEuros(resteTva)}. Anticipez la sortie de franchise.`,
            danger: `⚠ 90 % du seuil de franchise TVA atteint. Limitez les encaissements jusqu'à fin ${annee} ou préparez le passage au régime TVA.`,
            critical:
              "Seuil de franchise TVA dépassé — rapprochez-vous du SIE : au-delà du seuil majoré, la TVA s'applique immédiatement et les mentions de vos factures doivent changer.",
          }}
        />

        <Jauge
          titre="Plafond du régime micro (prestations de services)"
          sousTitre="Micro-BIC · perte du régime après 2 années consécutives de dépassement"
          ca={caEncaisseAnnee}
          seuil={PLAFOND_MICRO_SERVICES}
          messages={{
            ok: `Il reste ${formatEuros(resteMicro)} avant le plafond micro.`,
            warn: `⚠ 80 % du plafond micro atteint — il reste ${formatEuros(resteMicro)}.`,
            danger: `⚠ 90 % du plafond micro atteint. Surveillez vos encaissements de fin d'année.`,
            critical:
              "Plafond micro dépassé. Un 2ᵉ dépassement l'an prochain ferait sortir du régime micro — parlez-en à votre comptable.",
          }}
        />

        <p className="text-xs text-muted-foreground">
          Seuils {annee} configurés dans l&apos;application (lib/seuils-micro.ts)
          — à vérifier chaque année en loi de finances.
        </p>
      </CardContent>
    </Card>
  );
}
