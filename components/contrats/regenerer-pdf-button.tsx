"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { regenererPdfContratAction } from "@/lib/actions/contrats-entretien";
import { Button } from "@/components/ui/button";

/**
 * Régénère le PDF archivé d'un contrat signé dont le fichier manque.
 * La signature, le statut et le contenu ne bougent pas — seul le
 * fichier et son empreinte sont écrits.
 */
export function RegenererPdfButton({
  contratId,
  numero,
  variant = "outline",
  size,
  className,
}: {
  contratId: string;
  numero: string | null;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const res = await regenererPdfContratAction(contratId);
    setPending(false);
    if (!res.ok) {
      toast.error("Régénération impossible", { description: res.error });
      return;
    }
    toast.success(`PDF du contrat ${numero ?? ""} régénéré`.trim(), {
      description: "Le document signé est de nouveau téléchargeable.",
    });
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileWarning className="size-4" />
      )}
      Régénérer le PDF signé
    </Button>
  );
}
