"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * Actions d'une fiche (facture, devis) : en ligne dans l'en-tête sur PC ;
 * sur téléphone, un seul bouton « Actions » ouvre un tiroir du bas où
 * les mêmes boutons sont empilés, pleine largeur, sous le pouce — au
 * lieu d'une pile de boutons qui repousse le contenu.
 *
 * Les enfants ne sont rendus QU'UNE FOIS (PC ou tiroir, selon la
 * largeur d'écran) : le double rendu dupliquait les `id` des dialogues
 * (motif d'annulation, montant du paiement…) et les libellés ciblaient
 * la copie masquée.
 */
export function ActionsFiche({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const maj = () => setMobile(mq.matches);
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);

  if (!mobile) {
    return <div className="flex flex-wrap items-center gap-2">{children}</div>;
  }
  return (
    <div>
      <Button variant="outline" size="sm" onClick={() => setOuvert(true)}>
        <MoreHorizontal className="size-4" />
        Actions
      </Button>
      <Sheet open={ouvert} onOpenChange={setOuvert}>
        <SheetContent side="bottom" className="p-4 pt-5">
          <SheetTitle className="mb-3">Actions</SheetTitle>
          <div
            onClick={(e) => {
              // Un lien (PDF, nouveau devis…) ferme le tiroir ; les
              // boutons qui ouvrent un dialogue le gardent ouvert.
              if ((e.target as HTMLElement).closest("a")) setOuvert(false);
            }}
            className="flex flex-col gap-2 [&_a]:w-full [&_a]:justify-start [&_button]:w-full [&_button]:justify-start [&_div.flex-wrap]:flex-col [&_div.flex-wrap]:items-stretch"
          >
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
