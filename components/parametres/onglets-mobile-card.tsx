"use client";

import { useEffect, useState } from "react";
import { Smartphone, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { ecrireOnglets, lireOnglets, NB_ONGLETS, ONGLETS_PAR_DEFAUT, ONGLETS_POSSIBLES } from "@/lib/onglets-mobile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Onglets de la barre du bas du téléphone : quatre écrans au choix,
 * mémorisés sur CET appareil (chaque téléphone a sa barre). Sans effet
 * sur PC, où la barre latérale reste la navigation.
 */
export function OngletsMobileCard() {
  const [onglets, setOnglets] = useState<string[]>(ONGLETS_PAR_DEFAUT);
  useEffect(() => {
    setOnglets(lireOnglets());
  }, []);

  function choisir(index: number, href: string) {
    const suivant = [...onglets];
    // Un écran ne figure qu'une fois : s'il est déjà pris, on échange.
    const deja = suivant.indexOf(href);
    if (deja >= 0 && deja !== index) suivant[deja] = suivant[index]!;
    suivant[index] = href;
    setOnglets(suivant);
    ecrireOnglets(suivant);
    toast.success("Barre d'onglets mise à jour");
  }
  function reinitialiser() {
    setOnglets([...ONGLETS_PAR_DEFAUT]);
    ecrireOnglets([...ONGLETS_PAR_DEFAUT]);
    toast.success("Onglets par défaut rétablis");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="size-4 text-primary" />
          Onglets du téléphone
        </CardTitle>
        <CardDescription>
          Les quatre écrans de la barre du bas, à un tap du pouce. Le choix est mémorisé sur cet appareil (réglez-le depuis votre téléphone) ; « Plus » donne accès au reste.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: NB_ONGLETS }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Label htmlFor={`onglet-${i}`}>Onglet {i + 1}</Label>
              <Select value={onglets[i] ?? ""} onValueChange={(v) => choisir(i, v)}>
                <SelectTrigger id={`onglet-${i}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONGLETS_POSSIBLES.map((o) => (
                    <SelectItem key={o.href} value={o.href}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={reinitialiser}>
          <Undo2 className="size-4" />
          Rétablir Agenda · Devis · Factures · Interventions
        </Button>
      </CardContent>
    </Card>
  );
}
