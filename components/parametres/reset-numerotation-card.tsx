"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { resetNumerotationAction } from "@/lib/actions/factures";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const CURRENT_YEAR = new Date().getFullYear();

export function ResetNumerotationCard() {
  const [pending, startTransition] = useTransition();
  const [pendingType, setPendingType] = useState<"facture" | "devis" | null>(
    null,
  );

  const handleReset = (type: "facture" | "devis") => {
    setPendingType(type);
    startTransition(async () => {
      const res = await resetNumerotationAction(type, CURRENT_YEAR);
      setPendingType(null);
      if (res.ok) {
        toast.success(
          `Compteur ${type} ${CURRENT_YEAR} remis à zéro. Le prochain document sera ${type === "facture" ? "F" : "D"}-${CURRENT_YEAR}-0001.`,
        );
      } else {
        toast.error("Impossible", { description: res.error });
      }
    });
  };

  return (
    <Card className="border-amber-300/60 bg-amber-50/30 dark:bg-amber-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5 text-amber-700 dark:text-amber-400" />
          Zone test — Réinitialisation
        </CardTitle>
        <CardDescription>
          Outils pour repartir d'une base propre en phase d'essai. À ne pas
          utiliser en production une fois les premières vraies factures
          émises (impact fiscal).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5 text-sm">
          <p className="font-medium">Compteur de numérotation {CURRENT_YEAR}</p>
          <p className="text-muted-foreground">
            Remet le compteur à zéro pour que la prochaine facture / le prochain
            devis reprennent à <code className="font-mono">0001</code>. Refusé
            tant qu'il reste des documents de cette année en base —{" "}
            <strong>supprime d'abord toutes les factures / devis de {CURRENT_YEAR}</strong>{" "}
            (annule celles qui sont envoyées/payées, puis « Supprimer (test) »).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="border-amber-300"
              >
                {pending && pendingType === "facture" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Réinitialiser compteur factures
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Remettre le compteur factures à zéro ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  La prochaine facture créée portera le numéro{" "}
                  <strong>F-{CURRENT_YEAR}-0001</strong>. À utiliser
                  uniquement après avoir supprimé toutes les factures de{" "}
                  {CURRENT_YEAR} (phase de test).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleReset("facture")}>
                  Réinitialiser
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                className="border-amber-300"
              >
                {pending && pendingType === "devis" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RotateCcw className="size-4" />
                )}
                Réinitialiser compteur devis
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Remettre le compteur devis à zéro ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Le prochain devis créé portera le numéro{" "}
                  <strong>D-{CURRENT_YEAR}-0001</strong>. À utiliser
                  uniquement après avoir supprimé tous les devis de{" "}
                  {CURRENT_YEAR}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleReset("devis")}>
                  Réinitialiser
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
