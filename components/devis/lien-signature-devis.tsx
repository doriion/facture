"use client";

import { Copy, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/format";

/**
 * Fiche devis : état du lien de signature en ligne (posé à l'envoi par
 * e-mail) et bouton pour le copier, à coller dans un SMS par exemple.
 */
export function LienSignatureDevis({
  token,
  expireLe,
  signeEnLigne,
}: {
  token: string | null;
  /** ISO */
  expireLe: string | null;
  signeEnLigne: { le: string | null; ip: string | null } | null;
}) {
  if (signeEnLigne) {
    return (
      <p className="text-xs text-muted-foreground">
        Signé en ligne{signeEnLigne.le ? ` le ${new Date(signeEnLigne.le).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })}` : ""}
        {signeEnLigne.ip ? ` · IP ${signeEnLigne.ip}` : ""}
      </p>
    );
  }
  if (!token) return null;
  const expire = expireLe ? formatDateFr(expireLe.slice(0, 10)) : null;
  const perime = expireLe ? new Date(expireLe).getTime() < Date.now() : false;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Link2 className="size-3.5" aria-hidden="true" />
      <span>
        Lien de signature en ligne{expire ? (perime ? ` expiré le ${expire}` : ` valable jusqu'au ${expire}`) : ""}
      </span>
      {!perime && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() =>
            void navigator.clipboard
              .writeText(`${window.location.origin}/d/${token}`)
              .then(() => toast.success("Lien de signature copié."))
          }
        >
          <Copy className="size-3.5" />
          Copier
        </Button>
      )}
      {!perime && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => {
            const url = `${window.location.origin}/d/${token}`;
            if (typeof navigator.share === "function") {
              void navigator.share({ title: "Devis à signer", text: `Bonjour, voici le devis à relire et signer en ligne : ${url}` }).catch(() => {});
            } else {
              void navigator.clipboard.writeText(url).then(() => toast.success("Lien de signature copié."));
            }
          }}
        >
          <Share2 className="size-3.5" />
          Partager (SMS, WhatsApp…)
        </Button>
      )}
    </div>
  );
}
