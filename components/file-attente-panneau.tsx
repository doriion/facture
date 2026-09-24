"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, CloudUpload, Loader2, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EVENEMENT, listerFile, supprimerDeFile } from "@/lib/file-attente";
import { libelleEntree, resumerFile, type EntreeFile } from "@/lib/file-attente-helpers";
import { reessayerEntree, rejouerFile } from "@/lib/file-attente-rejeu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Suivi des modifications faites hors ligne : pastille dans le bandeau
 * (« 3 en attente »), envoi automatique au retour du réseau et à chaque
 * ouverture, panneau pour voir, réessayer ou abandonner ce qui a été
 * refusé par le serveur.
 */
export function FileAttentePanneau() {
  const router = useRouter();
  const [entrees, setEntrees] = useState<EntreeFile[]>([]);
  const [open, setOpen] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const recharger = useCallback(async () => {
    try {
      setEntrees(await listerFile());
    } catch {
      setEntrees([]);
    }
  }, []);

  const envoyer = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    setEnvoi(true);
    const r = await rejouerFile();
    setEnvoi(false);
    await recharger();
    if (r.envoyees > 0) {
      toast.success(
        r.envoyees > 1 ? `${r.envoyees} modifications envoyées` : "Modification envoyée",
        { description: "Faites hors ligne, maintenant enregistrées." },
      );
      router.refresh();
    }
    if (r.enErreur > 0) {
      toast.error(
        r.enErreur > 1
          ? `${r.enErreur} modifications refusées par le serveur`
          : "Une modification a été refusée par le serveur",
        { description: "Ouvrez « En attente » dans le bandeau pour décider." },
      );
    }
  }, [recharger, router]);

  useEffect(() => {
    void recharger().then(() => envoyer());
    const surChangement = () => void recharger();
    const surRetour = () => void envoyer();
    window.addEventListener(EVENEMENT, surChangement);
    window.addEventListener("online", surRetour);
    return () => {
      window.removeEventListener(EVENEMENT, surChangement);
      window.removeEventListener("online", surRetour);
    };
  }, [recharger, envoyer]);

  const resume = resumerFile(entrees);
  if (resume.total === 0) return null;

  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  let texteBandeau: string;
  if (envoi) {
    texteBandeau = "Envoi des modifications faites hors ligne…";
  } else if (resume.enErreur > 0) {
    texteBandeau =
      `${pluriel(resume.enErreur, "modification")} refusée${resume.enErreur > 1 ? "s" : ""}` +
      (resume.enAttente > 0 ? `, ${resume.enAttente} en attente` : "") +
      " — toucher pour décider";
  } else {
    texteBandeau = `${pluriel(resume.enAttente, "modification")} en attente de réseau`;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-2 border-b px-3 py-1.5 text-left text-xs sm:px-6 ${
          resume.enErreur > 0
            ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
            : "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
        }`}
      >
        {envoi ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : resume.enErreur > 0 ? (
          <CloudOff className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <CloudUpload className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span>{texteBandeau}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifications faites hors ligne</DialogTitle>
            <DialogDescription>
              Elles partent toutes seules au retour du réseau. Une ligne en
              rouge a été refusée par le serveur : réessayez ou abandonnez.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50dvh] divide-y overflow-y-auto text-sm">
            {entrees.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{libelleEntree(e)}</p>
                  <p className={`text-xs ${e.erreur ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}>
                    {e.erreur ?? "En attente de réseau"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {e.erreur && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Réessayer"
                      onClick={async () => {
                        await reessayerEntree(e.id);
                        await recharger();
                        router.refresh();
                      }}
                    >
                      <RotateCw className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    aria-label="Abandonner cette modification"
                    onClick={async () => {
                      await supprimerDeFile(e.id);
                      await recharger();
                      toast("Modification abandonnée");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={envoyer} disabled={envoi || resume.enAttente === 0}>
            {envoi ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
            Envoyer maintenant
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
