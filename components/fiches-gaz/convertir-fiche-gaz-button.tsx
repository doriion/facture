"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Snowflake } from "lucide-react";
import { toast } from "sonner";

import { convertirEnFicheGazAction } from "@/lib/actions/fiches-gaz";
import { appelerAction } from "@/lib/appel-action";
import { Button } from "@/components/ui/button";

/**
 * Depuis une intervention ordinaire : en faire une fiche gaz sans la
 * dupliquer (même rendez-vous, même facture), puis ouvrir la fiche.
 */
export function ConvertirFicheGazButton({ interventionId }: { interventionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function convertir() {
    setPending(true);
    const res = await appelerAction(() => convertirEnFicheGazAction(interventionId));
    setPending(false);
    if (!res.ok) {
      toast.error("Impossible de créer la fiche gaz", { description: res.error });
      return;
    }
    router.push(`/fiches-gaz/${res.data.id}`);
  }
  return (
    <Button variant="outline" onClick={convertir} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Snowflake className="size-4" />}
      Créer la fiche gaz
    </Button>
  );
}
