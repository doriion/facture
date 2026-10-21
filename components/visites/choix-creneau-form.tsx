"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Option = { valeur: "propose" | number | "aucun"; libelle: string; detail?: string };

/**
 * Page publique : le client confirme le créneau proposé, en choisit un
 * autre, ou indique qu'aucun ne convient (avec un mot). Un seul envoi.
 */
export function ChoixCreneauForm({
  token,
  creneauPropose,
  autres,
}: {
  token: string;
  creneauPropose: string;
  autres: Array<{ index: number; libelle: string }>;
}) {
  const router = useRouter();
  const [choix, setChoix] = useState<"propose" | number | "aucun">("propose");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const options: Option[] = [
    { valeur: "propose", libelle: creneauPropose, detail: "Créneau proposé" },
    ...autres.map((a) => ({ valeur: a.index, libelle: a.libelle })),
    { valeur: "aucun", libelle: "Aucun de ces créneaux ne me convient" },
  ];

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (envoi) return;
    setEnvoi(true);
    try {
      const res = await fetch(`/api/public/visites/${encodeURIComponent(token)}/repondre`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choix, message }),
      });
      const corps = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !corps.ok) {
        toast.error(corps.error ?? "Votre réponse n'a pas pu être enregistrée.");
        setEnvoi(false);
        if (res.status === 409 || res.status === 410) router.refresh();
        return;
      }
      router.refresh();
    } catch {
      toast.error("Erreur réseau — vérifiez votre connexion et réessayez.");
      setEnvoi(false);
    }
  }

  const cle = (v: Option["valeur"]) => String(v);

  return (
    <form onSubmit={envoyer} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">Quel créneau vous convient ?</legend>
        {options.map((o) => {
          const actif = cle(o.valeur) === cle(choix);
          return (
            <label
              key={cle(o.valeur)}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                actif ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              } ${o.valeur === "aucun" ? "text-muted-foreground" : ""}`}
            >
              <input
                type="radio"
                name="creneau"
                className="mt-0.5 size-4 accent-primary"
                checked={actif}
                onChange={() => setChoix(o.valeur)}
              />
              <span>
                <span className={o.valeur === "aucun" ? "" : "font-medium text-foreground"}>{o.libelle}</span>
                {o.detail && <span className="block text-xs text-muted-foreground">{o.detail}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>

      {choix === "aucun" && (
        <div className="space-y-1.5">
          <label htmlFor="message" className="text-sm font-medium">
            Vos disponibilités ou un mot (facultatif)
          </label>
          <Textarea
            id="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex : plutôt en fin de journée, ou après le 15."
            maxLength={1000}
          />
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={envoi}>
        {envoi ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
        {choix === "aucun" ? "Envoyer ma réponse" : "Confirmer ce créneau"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Votre choix s&apos;inscrit directement dans l&apos;agenda de votre artisan ; vous recevez un e-mail de confirmation.
      </p>
    </form>
  );
}
