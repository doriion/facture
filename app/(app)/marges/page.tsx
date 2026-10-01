import Link from "next/link";
import { EyeOff } from "lucide-react";

import { getMargesAnnee } from "@/lib/actions/marges";
import { aujourdhuiParis } from "@/lib/dates";
import { MargesVue } from "@/components/marges/marges-vue";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Marges — NG Gestion" };

/**
 * Suivi de marge par chantier et par mois. Page INTERNE : rien d'ici
 * n'apparaît sur un PDF, un e-mail ou un lien public.
 */
export default async function MargesPage(props: { searchParams: Promise<{ annee?: string }> }) {
  const { annee: anneeParam } = await props.searchParams;
  const anneeCourante = Number(aujourdhuiParis().slice(0, 4));
  const annee = anneeParam && /^\d{4}$/.test(anneeParam) ? Number(anneeParam) : anneeCourante;
  const marges = await getMargesAnnee(annee);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Marges {annee}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <EyeOff className="size-3.5" />
            Suivi interne : total HT facturé moins les achats saisis sur les lignes. Jamais sur un document client.
          </p>
        </div>
        <div className="flex gap-2">
          {[anneeCourante, anneeCourante - 1].map((a) => (
            <Button key={a} asChild size="sm" variant={a === annee ? "default" : "outline"}>
              <Link href={`/marges?annee=${a}`}>{a}</Link>
            </Button>
          ))}
        </div>
      </div>

      <MargesVue marges={marges} />
    </div>
  );
}
