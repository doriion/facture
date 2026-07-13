"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Copy,
  Download,
  Loader2,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteFactureAction,
  duplicateFactureAction,
  setFactureStatutAction,
} from "@/lib/actions/factures";
import {
  getFacturePaiements,
  repasserEnvoyeeAction,
} from "@/lib/actions/paiements";
import { formatEuros } from "@/lib/format";
import { MarquerPayeeButton } from "@/components/factures/marquer-payee-button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StatutFacture } from "@/lib/validations/facture";
import { EmailDocumentButton } from "@/components/email-document-button";

/**
 * Boutons d'action contextuels selon le statut courant de la facture.
 * Affiché en haut de la page de détail.
 */
export function FactureActions({
  factureId,
  numero,
  statut,
  clientEmail,
  clientNom,
}: {
  factureId: string;
  numero: string;
  statut: StatutFacture | string;
  clientEmail?: string | null;
  clientNom?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [annulerOpen, setAnnulerOpen] = useState(false);
  const [motif, setMotif] = useState("");

  // Flux inverse « payée → envoyée » : proposer de supprimer les
  // paiements associés (sinon le CA encaissé resterait gonflé alors
  // que la facture redevient impayée).
  const [annulerPaiementOpen, setAnnulerPaiementOpen] = useState(false);
  const [nbPaiements, setNbPaiements] = useState(0);
  const [totalEncaisse, setTotalEncaisse] = useState(0);
  const [supprimerPaiements, setSupprimerPaiements] = useState(true);

  useEffect(() => {
    if (!annulerPaiementOpen) return;
    getFacturePaiements(factureId).then((summary) => {
      setNbPaiements(summary.paiements.length);
      setTotalEncaisse(summary.total_encaisse);
      setSupprimerPaiements(summary.paiements.length > 0);
    });
  }, [annulerPaiementOpen, factureId]);

  async function confirmAnnulerPaiement() {
    setPending("envoyee");
    const result = await repasserEnvoyeeAction(
      factureId,
      supprimerPaiements && nbPaiements > 0,
    );
    setPending(null);
    setAnnulerPaiementOpen(false);
    if (result.ok) {
      toast.success(
        supprimerPaiements && nbPaiements > 0
          ? "Facture repassée en envoyée — paiements supprimés"
          : "Facture repassée en envoyée",
      );
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function changeStatut(
    next: "brouillon" | "envoyee" | "payee" | "annulee",
    successMsg: string,
    motifText?: string,
  ) {
    setPending(next);
    const result = await setFactureStatutAction(factureId, next, motifText);
    setPending(null);
    if (result.ok) {
      toast.success(successMsg);
      router.refresh();
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function confirmAnnulation() {
    if (!motif.trim()) {
      toast.error("Motif obligatoire", {
        description: "Indiquez la raison de l'annulation pour la traçabilité fiscale.",
      });
      return;
    }
    await changeStatut("annulee", "Facture annulée", motif.trim());
    setAnnulerOpen(false);
    setMotif("");
  }

  async function onDelete() {
    setPending("delete");
    const result = await deleteFactureAction(factureId);
    setPending(null);
    if (result.ok) {
      toast.success("Brouillon supprimé");
      router.push("/factures");
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  async function onDuplicate() {
    setPending("duplicate");
    const result = await duplicateFactureAction(factureId);
    setPending(null);
    if (result.ok) {
      toast.success(`Facture ${result.data.numero} créée`, {
        description: "Brouillon dupliqué — modifiez avant envoi.",
      });
      router.push(`/factures/${result.data.factureId}`);
    } else {
      toast.error("Erreur", { description: result.error });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" asChild>
        <a href={`/api/factures/${factureId}/pdf`} download>
          <Download className="size-4" />
          Télécharger PDF
        </a>
      </Button>

      {statut !== "annulee" && (
        <EmailDocumentButton
          documentId={factureId}
          type="facture"
          destinataireEmail={clientEmail ?? null}
          destinataireNom={clientNom ?? "le client"}
          variant="outline"
        />
      )}

      <Button
        variant="outline"
        onClick={onDuplicate}
        disabled={pending === "duplicate"}
      >
        {pending === "duplicate" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Copy className="size-4" />
        )}
        Dupliquer
      </Button>

      {statut === "brouillon" && (
        <>
          <Button
            onClick={() => changeStatut("envoyee", "Facture marquée envoyée")}
            disabled={pending === "envoyee"}
          >
            {pending === "envoyee" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Marquer envoyée
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              {/* Sur mobile : ligne à part, éloignée des actions
                  courantes pour éviter les taps accidentels. */}
              <Button
                variant="outline"
                className="text-destructive max-sm:mt-1 max-sm:w-full"
              >
                <Trash2 className="size-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer ce brouillon ?</AlertDialogTitle>
                <AlertDialogDescription>
                  La facture <strong>{numero}</strong> sera supprimée
                  définitivement. Cette action est possible uniquement parce
                  qu'elle est en brouillon — les factures envoyées doivent être
                  annulées (et non supprimées) pour respecter la traçabilité légale.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={pending === "delete"}
                >
                  {pending === "delete" && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {statut === "envoyee" && (
        <>
          <MarquerPayeeButton factureId={factureId} />
          <Button
            variant="outline"
            onClick={() => changeStatut("brouillon", "Repassée en brouillon")}
            disabled={pending === "brouillon"}
          >
            {pending === "brouillon" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Undo2 className="size-4" />
            )}
            Repasser en brouillon
          </Button>
          <Button
            variant="outline"
            className="text-destructive max-sm:mt-1 max-sm:w-full"
            onClick={() => setAnnulerOpen(true)}
            disabled={pending === "annulee"}
          >
            <Ban className="size-4" />
            Annuler
          </Button>
        </>
      )}

      {statut === "payee" && (
        <Button
          variant="outline"
          onClick={() => setAnnulerPaiementOpen(true)}
          disabled={pending === "envoyee"}
        >
          <Undo2 className="size-4" />
          Annuler le paiement
        </Button>
      )}

      {statut === "annulee" && (
        <>
          <Button
            variant="outline"
            onClick={() => changeStatut("brouillon", "Facture restaurée en brouillon")}
            disabled={pending === "brouillon"}
          >
            <Undo2 className="size-4" />
            Restaurer en brouillon
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive max-sm:mt-1 max-sm:w-full"
              >
                <Trash2 className="size-4" />
                Supprimer (test)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer définitivement {numero} ?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      ⚠️ <strong>À n'utiliser qu'en phase de test.</strong> En usage
                      réel, garde plutôt les factures annulées en base : leur
                      conservation justifie le « trou » dans la séquence des
                      numéros en cas de contrôle fiscal.
                    </p>
                    <p>
                      La facture <strong>{numero}</strong> sera supprimée
                      définitivement, mais le numéro reste « consommé » par le
                      compteur. Pour repartir d'une numérotation propre,
                      utilise « Réinitialiser la numérotation » dans Paramètres
                      après avoir supprimé toutes les factures de l'année.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={pending === "delete"}
                >
                  {pending === "delete" && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      <Dialog
        open={annulerPaiementOpen}
        onOpenChange={setAnnulerPaiementOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Repasser {numero} en « envoyée » ?</DialogTitle>
            <DialogDescription>
              {nbPaiements > 0 ? (
                <>
                  Cette facture a {nbPaiements} paiement
                  {nbPaiements > 1 ? "s" : ""} enregistré
                  {nbPaiements > 1 ? "s" : ""} pour un total de{" "}
                  <strong>{formatEuros(totalEncaisse)}</strong>. Sans
                  suppression, ce montant continuerait de compter dans le CA
                  encaissé (jauges, export URSSAF) alors que la facture
                  redevient impayée.
                </>
              ) : (
                "Aucun paiement n'est enregistré sur cette facture — seul le statut sera modifié."
              )}
            </DialogDescription>
          </DialogHeader>

          {nbPaiements > 0 && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={supprimerPaiements}
                onChange={(e) => setSupprimerPaiements(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Supprimer {nbPaiements > 1 ? "les" : "le"} {nbPaiements}{" "}
                paiement{nbPaiements > 1 ? "s" : ""} associé
                {nbPaiements > 1 ? "s" : ""} ({formatEuros(totalEncaisse)})
              </span>
            </label>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAnnulerPaiementOpen(false)}
              disabled={pending === "envoyee"}
            >
              Retour
            </Button>
            <Button
              variant={supprimerPaiements && nbPaiements > 0 ? "destructive" : "default"}
              onClick={confirmAnnulerPaiement}
              disabled={pending === "envoyee"}
            >
              {pending === "envoyee" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Undo2 className="size-4" />
              )}
              {supprimerPaiements && nbPaiements > 0
                ? "Repasser en envoyée et supprimer"
                : "Repasser en envoyée"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={annulerOpen} onOpenChange={setAnnulerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la facture {numero} ?</DialogTitle>
            <DialogDescription>
              La facture sera conservée en base avec son numéro, marquée
              « Annulée ». Le motif est obligatoire pour justifier le « trou »
              dans la séquence en cas de contrôle fiscal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motif">Motif d'annulation *</Label>
            <Textarea
              id="motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              placeholder="Ex : erreur sur le montant, client a annulé la commande, doublon avec F-2026-XXXX…"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAnnulerOpen(false)}
              disabled={pending === "annulee"}
            >
              Retour
            </Button>
            <Button
              variant="destructive"
              onClick={confirmAnnulation}
              disabled={pending === "annulee" || !motif.trim()}
            >
              {pending === "annulee" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Ban className="size-4" />
              )}
              Confirmer l'annulation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
