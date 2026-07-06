"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { envoyerRelanceFactureAction } from "@/lib/actions/emails";
import type { FactureEnRetard } from "@/lib/actions/relances";
import { formatDateFr, formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Section « Factures en retard » de la page /factures : liste les
 * impayées dont l'échéance est dépassée, avec bouton de relance email
 * MANUELLE (confirmation avant envoi, PDF joint).
 */
export function RelancesSection({
  factures,
}: {
  factures: FactureEnRetard[];
}) {
  const router = useRouter();
  const [confirmFacture, setConfirmFacture] = useState<FactureEnRetard | null>(
    null,
  );
  const [sendingId, setSendingId] = useState<string | null>(null);

  if (factures.length === 0) return null;

  const totalRetard = factures.reduce((s, f) => s + f.total_ht, 0);

  async function envoyer(facture: FactureEnRetard) {
    setConfirmFacture(null);
    setSendingId(facture.id);
    const result = await envoyerRelanceFactureAction(facture.id);
    setSendingId(null);
    if (result.ok) {
      toast.success(`Relance envoyée pour ${facture.numero}`, {
        description: `Email adressé à ${facture.client_email}.`,
      });
      router.refresh();
    } else {
      toast.error("Échec de la relance", { description: result.error });
    }
  }

  return (
    <Card className="border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <CardTitle className="text-base">
              {factures.length} facture{factures.length > 1 ? "s" : ""} en
              retard — {formatEuros(totalRetard)}
            </CardTitle>
            <CardDescription>
              Échéance dépassée et paiement non reçu. La relance envoie un
              email au client avec le PDF de la facture joint — rien ne part
              sans votre clic.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {factures.map((f) => (
          <div
            key={f.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border bg-background p-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link
                  href={`/factures/${f.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {f.numero}
                </Link>
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                  J+{f.joursRetard}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {f.client_nom ?? "Client inconnu"} · {formatEuros(f.total_ht)} ·
                échéance {formatDateFr(f.date_echeance)}
                {f.derniereRelance && (
                  <>
                    {" "}
                    · relancée le {formatDateFr(f.derniereRelance)}
                    {f.nbRelances > 1 ? ` (${f.nbRelances}×)` : ""}
                  </>
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sendingId === f.id || !f.client_email}
              title={
                f.client_email
                  ? `Envoyer une relance à ${f.client_email}`
                  : "Le client n'a pas d'adresse email — renseignez-la sur sa fiche."
              }
              onClick={() => setConfirmFacture(f)}
            >
              {sendingId === f.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Envoyer une relance
            </Button>
          </div>
        ))}
      </CardContent>

      <AlertDialog
        open={confirmFacture !== null}
        onOpenChange={(open) => !open && setConfirmFacture(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Relancer la facture {confirmFacture?.numero} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Un email de relance (ton courtois, PDF joint) sera envoyé à{" "}
              <strong>{confirmFacture?.client_email}</strong> pour la facture
              de {confirmFacture ? formatEuros(confirmFacture.total_ht) : ""}
              {" "}échue le{" "}
              {confirmFacture ? formatDateFr(confirmFacture.date_echeance) : ""}
              {confirmFacture?.derniereRelance
                ? ` (déjà relancée le ${formatDateFr(confirmFacture.derniereRelance)})`
                : ""}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmFacture && envoyer(confirmFacture)}
            >
              Envoyer la relance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
