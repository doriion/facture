"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  restaurerInterventionAction,
  supprimerDefinitivementAction,
  type InterventionCorbeille,
} from "@/lib/actions/interventions";
import { ageCorbeille } from "@/lib/corbeille";
import { formatDateFr } from "@/lib/format";
import { LABELS_TYPE_INTERVENTION } from "@/lib/validations/intervention";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Corbeille des interventions : restaurer d'un clic, ou effacer pour de
 * bon (confirmation). La ligne disparaît tout de suite ; retour si le
 * serveur refuse.
 */
export function CorbeilleListe({ lignes }: { lignes: InterventionCorbeille[] }) {
  const router = useRouter();
  const [visibles, setVisibles] = useState(lignes);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function restaurer(l: InterventionCorbeille) {
    setEnCours(l.id);
    setVisibles((v) => v.filter((x) => x.id !== l.id));
    const r = await restaurerInterventionAction(l.id);
    setEnCours(null);
    if (!r.ok) {
      setVisibles((v) => [l, ...v]);
      toast.error("Restauration refusée", { description: r.error });
      return;
    }
    toast.success("Intervention restaurée", {
      action: { label: "Ouvrir", onClick: () => router.push(`/interventions/${l.id}`) },
    });
    router.refresh();
  }

  async function effacer(l: InterventionCorbeille) {
    setEnCours(l.id);
    setVisibles((v) => v.filter((x) => x.id !== l.id));
    const r = await supprimerDefinitivementAction(l.id);
    setEnCours(null);
    if (!r.ok) {
      setVisibles((v) => [l, ...v]);
      toast.error("Effacement refusé", { description: r.error });
      return;
    }
    toast.success("Intervention effacée définitivement");
    router.refresh();
  }

  if (visibles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        La corbeille est vide.
      </div>
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {visibles.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {l.description ||
                LABELS_TYPE_INTERVENTION[l.type as keyof typeof LABELS_TYPE_INTERVENTION] ||
                l.type}
              {l.client_nom ? ` · ${l.client_nom}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateFr(l.date_intervention)}
              {l.date_fin && l.date_fin !== l.date_intervention ? ` → ${formatDateFr(l.date_fin)}` : ""}
              {l.heure_debut ? ` · ${l.heure_debut.slice(0, 5)}` : ""}
              {" · supprimée "}
              {ageCorbeille(l.supprime_le)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => restaurer(l)} disabled={enCours === l.id}>
              {enCours === l.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Restaurer
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={enCours === l.id}>
                  <Trash2 className="size-4" />
                  <span className="max-sm:hidden">Effacer</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Effacer définitivement ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette fois, c&apos;est irréversible. Une intervention avec
                    signatures ou fiches CERFA archivées (à conserver 5 ans)
                    ne peut pas être effacée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => effacer(l)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Effacer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/interventions/${l.id}`}>Fiche</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
