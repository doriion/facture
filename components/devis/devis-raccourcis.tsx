"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, Receipt, Send } from "lucide-react";
import { toast } from "sonner";

import { convertirDevisEnFactureAction, prolongerValiditeDevisAction } from "@/lib/actions/devis";
import { envoyerRelanceDevisAction } from "@/lib/actions/emails";
import { appelerAction } from "@/lib/appel-action";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/format";

/** Fil du jour : devis accepté → facture en un tap, puis ouverture de la facture. */
export function FacturerDevisButton({ devisId, size = "sm" }: { devisId: string; size?: "sm" | "default" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function facturer() {
    setPending(true);
    const res = await appelerAction(() => convertirDevisEnFactureAction(devisId));
    setPending(false);
    if (!res.ok) {
      toast.error("Conversion impossible", { description: res.error });
      return;
    }
    toast.success(`Facture ${res.data.numero} créée`);
    router.push(`/factures/${res.data.factureId}`);
  }
  return (
    <Button size={size} onClick={facturer} disabled={pending}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Receipt className="size-3.5" />}
      Facturer
    </Button>
  );
}

/** Relance d'un devis sans réponse : e-mail de rappel avec le PDF et le lien de signature. */
export function RelancerDevisButton({ devisId, clientEmail, size = "sm", variant = "outline" }: { devisId: string; clientEmail: string | null; size?: "sm" | "default"; variant?: "outline" | "default" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function relancer() {
    if (!clientEmail) {
      toast.info("Pas d'e-mail pour ce client", { description: "Renseignez-le sur la fiche client, ou relancez-le par téléphone." });
      return;
    }
    setPending(true);
    const res = await appelerAction(() => envoyerRelanceDevisAction(devisId));
    setPending(false);
    if (!res.ok) {
      toast.error("Relance non envoyée", { description: res.error });
      return;
    }
    toast.success("Relance envoyée", { description: `E-mail de rappel envoyé à ${clientEmail}.` });
    router.refresh();
  }
  return (
    <Button size={size} variant={variant} onClick={relancer} disabled={pending} className={!clientEmail ? "opacity-70" : undefined}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
      Relancer
    </Button>
  );
}

/** Devis expiré ou en fin de validité : 30 jours de plus, sans repasser en brouillon. */
export function ProlongerValiditeButton({ devisId, jours = 30 }: { devisId: string; jours?: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function prolonger() {
    setPending(true);
    const res = await appelerAction(() => prolongerValiditeDevisAction(devisId, jours));
    setPending(false);
    if (!res.ok) {
      toast.error("Prolongation impossible", { description: res.error });
      return;
    }
    toast.success(`Devis valable jusqu'au ${formatDateFr(res.data.date_validite)}`);
    router.refresh();
  }
  return (
    <Button variant="outline" onClick={prolonger} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
      Prolonger de {jours} jours
    </Button>
  );
}
