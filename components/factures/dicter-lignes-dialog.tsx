"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Sparkles } from "lucide-react";

import type { PrestationCatalogue } from "@/lib/catalogue-recherche";
import { lignesDepuisDictee, type LigneDictee } from "@/lib/dictee-lignes";
import { demarrerDictee, dicteeDisponible, type SessionDictee } from "@/lib/dictee-vocale";
import { formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * « Dicter » : on parle (ou on colle une liste), chaque élément devient
 * une ligne — quantité lue en tête, prestation retrouvée dans le
 * catalogue avec son prix, sinon ligne libre à chiffrer. Aperçu avant
 * d'ajouter, texte corrigeable au clavier.
 */
export function DicterLignesDialog({
  catalogue,
  onAjouter,
}: {
  catalogue: PrestationCatalogue[];
  onAjouter: (lignes: LigneDictee[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [texte, setTexte] = useState("");
  const [ecoute, setEcoute] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vocal, setVocal] = useState(false);
  const session = useRef<SessionDictee | null>(null);

  useEffect(() => setVocal(dicteeDisponible()), []);
  useEffect(() => {
    if (!open) {
      session.current?.arreter();
      session.current = null;
      setEcoute(false);
    }
  }, [open]);

  const lignes = useMemo(() => lignesDepuisDictee(texte, catalogue), [texte, catalogue]);

  function basculerEcoute() {
    if (ecoute) {
      session.current?.arreter();
      return;
    }
    setErreur(null);
    const prefixe = texte.trim() ? `${texte.trim()}, ` : "";
    const s = demarrerDictee({
      onTexte: (t) => setTexte(prefixe + t),
      onFin: () => {
        setEcoute(false);
        session.current = null;
      },
      onErreur: (m) => setErreur(m),
    });
    if (s) {
      session.current = s;
      setEcoute(true);
    }
  }

  function ajouter() {
    if (lignes.length === 0) return;
    onAjouter(lignes);
    setTexte("");
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Mic className="size-4" />
        Dicter
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dicter les lignes</DialogTitle>
            <DialogDescription>
              Dites les travaux séparés par « et » ou une pause : « deux heures de main-d&apos;œuvre, un ballon
              200 litres et 3 mètres de cuivre ». Les prestations du catalogue sont reconnues avec leur prix.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {vocal ? (
                <Button type="button" variant={ecoute ? "destructive" : "default"} onClick={basculerEcoute}>
                  {ecoute ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  {ecoute ? "Arrêter" : texte ? "Continuer la dictée" : "Parler"}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Pas de reconnaissance vocale dans ce navigateur : utilisez la dictée du clavier ou tapez la liste.
                </p>
              )}
              {ecoute && <span className="text-xs text-muted-foreground">Écoute en cours…</span>}
            </div>
            {erreur && <p className="text-sm text-destructive">{erreur}</p>}
            <Textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={4}
              placeholder="Ou tapez / collez : une ligne par élément, quantité en tête (ex. « 3 mètres de cuivre »)"
            />

            {lignes.length > 0 && (
              <ul className="divide-y rounded-md border text-sm">
                {lignes.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 px-3 py-2">
                    <span className="w-10 shrink-0 font-mono text-xs text-muted-foreground">{l.quantite} ×</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{l.designation}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.prestation ? (
                          <>
                            <Sparkles className="mr-1 inline size-3 text-primary" />
                            catalogue · {formatEuros(Number(l.prix_unitaire_ht))} HT
                          </>
                        ) : (
                          "ligne libre, prix à saisir"
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={ajouter} disabled={lignes.length === 0}>
              Ajouter {lignes.length > 0 ? `${lignes.length} ligne${lignes.length > 1 ? "s" : ""}` : "les lignes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
