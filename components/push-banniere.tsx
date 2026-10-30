"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { enregistrerAbonnementPushAction } from "@/lib/actions/push";
import { abonnementExistant, etatPush, nomAppareil, sAbonner } from "@/lib/push/navigateur";
import { Button } from "@/components/ui/button";

const CLE_IGNOREE = "facture-ae:push-banniere-ignoree";
const RAPPEL_APRES_JOURS = 14;

/**
 * Bandeau « Activer les notifications » : tant que CET appareil n'est
 * pas abonné, les alertes (devis signé, visite confirmée, fiche gaz
 * signée, rappels) ne lui parviennent pas. Un tap suffit ; « Plus
 * tard » le masque deux semaines. Rien n'est affiché si le navigateur
 * ne sait pas faire ou si l'appareil est déjà abonné.
 */
export function PushBanniere() {
  const clePublique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  const [visible, setVisible] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!clePublique) return;
    if (etatPush() !== "pret") return;
    try {
      const ignoree = Number(localStorage.getItem(CLE_IGNOREE) ?? "0");
      if (ignoree && Date.now() - ignoree < RAPPEL_APRES_JOURS * 24 * 3600 * 1000) return;
    } catch {
      // Stockage indisponible : on propose quand même.
    }
    abonnementExistant()
      .then((a) => {
        if (!a) setVisible(true);
      })
      .catch(() => {});
  }, [clePublique]);

  if (!visible) return null;

  async function activer() {
    setEnCours(true);
    const res = await sAbonner(clePublique);
    if (!res.ok) {
      setEnCours(false);
      toast.error("Notifications non activées", { description: res.erreur });
      return;
    }
    const enreg = await enregistrerAbonnementPushAction({ ...res.abonnement, appareil: nomAppareil() });
    setEnCours(false);
    if (!enreg.ok) {
      toast.error("Notifications non activées", { description: enreg.error });
      return;
    }
    toast.success("Notifications activées sur cet appareil");
    setVisible(false);
  }

  function plusTard() {
    try {
      localStorage.setItem(CLE_IGNOREE, String(Date.now()));
    } catch {
      // ignoré
    }
    setVisible(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
      <BellRing className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Activer les notifications sur ce téléphone</p>
        <p className="text-xs text-muted-foreground">Devis signé, visite confirmée, fiche gaz signée, rappel la veille et récap du matin.</p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={activer} disabled={enCours}>
          {enCours ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
          Activer
        </Button>
        <Button size="sm" variant="ghost" onClick={plusTard} aria-label="Plus tard">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
