import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";

import { listCorbeille } from "@/lib/actions/interventions";
import { CorbeilleListe } from "@/components/interventions/corbeille-liste";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Corbeille — NG Gestion" };

export default async function CorbeillePage() {
  const lignes = await listCorbeille();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/interventions">
            <ArrowLeft className="size-4" />
            Retour aux interventions
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <Trash2 className="size-5 text-muted-foreground" />
          Corbeille
        </h1>
        <p className="text-sm text-muted-foreground">
          Les interventions supprimées restent ici, avec leurs photos et
          documents. Restaurez-les d&apos;un clic, ou effacez-les pour de bon.
        </p>
      </div>
      <CorbeilleListe lignes={lignes} />
    </div>
  );
}
