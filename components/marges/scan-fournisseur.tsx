"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ClipboardPaste, EyeOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { appliquerCoutsAction, type CiblesCouts, type DocumentCible } from "@/lib/actions/factures-fournisseur";
import { appelerAction } from "@/lib/appel-action";
import { parserFactureFournisseur, scoreCorrespondance, type LigneFournisseur } from "@/lib/facture-fournisseur";
import { formatDateFr, formatEuros } from "@/lib/format";
import { compressImage } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EXEMPLE = `CEDEO Grenoble 05/11/2026
Groupe de sécurité 3/4 inox   24,90
2 x Flexible inox 50 cm        13,80
Chauffe-eau 200 L stéatite   389,00
TOTAL TTC                    427,70`;

/** Au-dessous, la correspondance n'est pas proposée (trop de mots différents). */
const SCORE_MIN = 0.34;
const AUCUNE = "aucune";
const CATALOGUE = "catalogue";

type LigneScan = LigneFournisseur & { cle: number; garder: boolean; cibleId: string };
type Option = { id: string; libelle: string; detail: string | null; prixActuel: number | null };

function libelleDocument(d: DocumentCible): string {
  return `${d.type === "devis" ? "Devis" : "Facture"} ${d.numero} · ${d.client || "sans client"} · ${formatDateFr(d.date)}`;
}

/** Pour chaque ligne lue, la ligne cible la plus proche (mots communs), chaque cible servant au plus une fois. */
function suggerer(lignes: LigneScan[], options: Option[]): Record<number, string> {
  const paires: Array<{ cle: number; id: string; score: number }> = [];
  for (const l of lignes) for (const o of options) {
    const score = scoreCorrespondance(l.designation, o.libelle);
    if (score >= SCORE_MIN) paires.push({ cle: l.cle, id: o.id, score });
  }
  paires.sort((a, b) => b.score - a.score);
  const resultat: Record<number, string> = {};
  const prises = new Set<string>();
  for (const p of paires) {
    if (resultat[p.cle] !== undefined || prises.has(p.id)) continue;
    resultat[p.cle] = p.id;
    prises.add(p.id);
  }
  return resultat;
}

export function ScanFournisseur({ cibles }: { cibles: CiblesCouts }) {
  const router = useRouter();
  const inputPhoto = useRef<HTMLInputElement | null>(null);
  const [texte, setTexte] = useState("");
  const [ocr, setOcr] = useState<string | null>(null);
  const [fournisseur, setFournisseur] = useState("");
  const [lignes, setLignes] = useState<LigneScan[] | null>(null);
  const [cible, setCible] = useState<string>(AUCUNE);
  const [envoi, setEnvoi] = useState(false);

  const lecture = useMemo(() => (texte.trim() ? parserFactureFournisseur(texte) : null), [texte]);

  const document = useMemo(() => {
    const [type, id] = cible.split(":");
    return cibles.documents.find((d) => d.type === type && d.id === id) ?? null;
  }, [cible, cibles.documents]);

  const options: Option[] = useMemo(() => {
    if (cible === CATALOGUE) return cibles.articles.map((a) => ({ id: a.id, libelle: a.designation, detail: null, prixActuel: a.prix_achat_ttc }));
    if (!document) return [];
    return document.lignes.map((l) => ({ id: l.id, libelle: l.designation, detail: `× ${l.quantite}`, prixActuel: l.prix_achat_ttc_unitaire }));
  }, [cible, document, cibles.articles]);

  // Nouvelle cible → correspondances re-proposées sur les lignes lues.
  useEffect(() => {
    setLignes((cur) => {
      if (!cur) return cur;
      const s = suggerer(cur, options);
      return cur.map((l) => ({ ...l, cibleId: s[l.cle] ?? "" }));
    });
  }, [options]);

  function verifier() {
    if (!lecture) return;
    setFournisseur((f) => f || lecture.fournisseur || "");
    const base = lecture.lignes.map((l, i) => ({ ...l, cle: i, garder: true, cibleId: "" }));
    const s = suggerer(base, options);
    setLignes(base.map((l) => ({ ...l, cibleId: s[l.cle] ?? "" })));
  }
  function maj(cle: number, patch: Partial<LigneScan>) {
    setLignes((l) => (l ?? []).map((x) => (x.cle === cle ? { ...x, ...patch } : x)));
  }

  async function photo(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setOcr("Préparation de la photo…");
    try {
      const image = await compressImage(fichier, 2000);
      setOcr("Chargement du moteur de lecture…");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("fra", 1, {
        logger: (m: { status?: string; progress?: number }) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") setOcr(`Lecture… ${Math.round(m.progress * 100)} %`);
        },
      });
      try {
        const { data } = await worker.recognize(image);
        const lu = (data.text ?? "").trim();
        if (!lu) toast.error("Rien de lisible sur la photo", { description: "Réessayez de plus près, bien à plat et éclairé." });
        else setTexte((t) => (t.trim() ? `${t.trim()}\n${lu}` : lu));
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      toast.error("Lecture impossible", { description: err instanceof Error && /fetch|network|load/i.test(err.message) ? "Le moteur de lecture n'a pas pu être téléchargé (réseau)." : "Réessayez avec une photo nette." });
    } finally {
      setOcr(null);
    }
  }

  const retenues = (lignes ?? []).filter((l) => l.garder);
  const pretes = retenues.filter((l) => l.cibleId && options.some((o) => o.id === l.cibleId));
  const totalRetenu = retenues.reduce((s, l) => s + l.montant, 0);

  async function appliquer() {
    if (pretes.length === 0) return;
    const type = cible === CATALOGUE ? "produit" : document?.type;
    if (!type) return;
    setEnvoi(true);
    const res = await appelerAction(() =>
      appliquerCoutsAction({
        fournisseur: fournisseur.trim() || null,
        cibles: pretes.map((l) => ({ type, id: l.cibleId, prixAchatUnitaire: l.prixUnitaire })),
      }),
    );
    setEnvoi(false);
    if (!res.ok) {
      toast.error("Enregistrement impossible", { description: res.error });
      return;
    }
    const d = res.data;
    const parts = [
      d.lignes ? `${d.lignes} ligne${d.lignes > 1 ? "s" : ""} de ${document?.type === "devis" ? "devis" : "facture"}` : null,
      d.articles ? `${d.articles} article${d.articles > 1 ? "s" : ""} du catalogue` : null,
      d.catalogue ? `${d.catalogue} article${d.catalogue > 1 ? "s" : ""} du catalogue complété${d.catalogue > 1 ? "s" : ""}` : null,
      d.echecs ? `${d.echecs} en échec` : null,
    ].filter(Boolean);
    toast.success("Prix d'achat enregistrés", { description: parts.join(" · ") });
    router.push(cible === CATALOGUE ? "/produits" : document ? `/${document.type === "devis" ? "devis" : "factures"}/${document.id}` : "/marges");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. La facture du fournisseur</CardTitle>
          <CardDescription>Photographiez le ticket ou la facture, ou collez son texte. La lecture se fait sur le téléphone : rien n&apos;est envoyé ailleurs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <input ref={inputPhoto} type="file" accept="image/*" capture="environment" onChange={photo} className="hidden" />
            <Button type="button" onClick={() => inputPhoto.current?.click()} disabled={ocr !== null}>
              {ocr ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              {ocr ?? "Photographier la facture"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  const t = await navigator.clipboard.readText();
                  if (t.trim()) setTexte(t);
                  else toast.info("Le presse-papiers est vide.");
                } catch {
                  toast.info("Collez le texte dans la zone ci-dessous (appui long → Coller).");
                }
              }}
            >
              <ClipboardPaste className="size-4" />
              Coller
            </Button>
          </div>
          <Textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={8} placeholder={EXEMPLE} className="font-mono text-sm" />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {lecture ? `${lecture.lignes.length} ligne${lecture.lignes.length > 1 ? "s" : ""} chiffrée${lecture.lignes.length > 1 ? "s" : ""}` : "Aucun texte"}
              {lecture?.totalTtc != null ? ` · total lu ${formatEuros(lecture.totalTtc)}` : ""}
            </p>
            <Button type="button" onClick={verifier} disabled={!lecture || lecture.lignes.length === 0}>
              Vérifier les lignes
            </Button>
          </div>
        </CardContent>
      </Card>

      {lignes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Rattacher les achats</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <EyeOff className="size-3.5 shrink-0" />
              Prix d&apos;achat TTC, privés : ils servent au suivi de marge et n&apos;apparaissent jamais sur un document client.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sf-fournisseur">Fournisseur</Label>
                <Input id="sf-fournisseur" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} placeholder="CEDEO, Richardson, Brico Dépôt…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sf-cible">Rattacher à</Label>
                <Select value={cible} onValueChange={setCible}>
                  <SelectTrigger id="sf-cible">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUCUNE}>Choisir un devis, une facture ou le catalogue…</SelectItem>
                    <SelectItem value={CATALOGUE}>Catalogue (articles)</SelectItem>
                    {cibles.documents.map((d) => (
                      <SelectItem key={`${d.type}:${d.id}`} value={`${d.type}:${d.id}`}>
                        {libelleDocument(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ul className="space-y-2">
              {lignes.map((l) => {
                const option = options.find((o) => o.id === l.cibleId);
                return (
                  <li key={l.cle} className={`rounded-lg border p-3 ${l.garder ? "" : "opacity-50"}`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" className="mt-2.5 size-4 accent-primary" checked={l.garder} onChange={(e) => maj(l.cle, { garder: e.target.checked })} aria-label="Retenir cette ligne" />
                      <div className="grid flex-1 gap-2">
                        <div className="grid grid-cols-[1fr_4rem_6rem] gap-2">
                          <Input value={l.designation} onChange={(e) => maj(l.cle, { designation: e.target.value })} aria-label="Désignation" className="font-medium" />
                          <Input
                            inputMode="decimal"
                            value={String(l.quantite).replace(".", ",")}
                            onChange={(e) => {
                              const q = Number(e.target.value.replace(",", "."));
                              if (Number.isFinite(q) && q > 0) maj(l.cle, { quantite: q, prixUnitaire: Math.round((l.montant / q) * 100) / 100 });
                            }}
                            aria-label="Quantité"
                          />
                          <Input
                            inputMode="decimal"
                            value={String(l.prixUnitaire).replace(".", ",")}
                            onChange={(e) => {
                              const p = Number(e.target.value.replace(",", "."));
                              if (Number.isFinite(p) && p >= 0) maj(l.cle, { prixUnitaire: p, montant: Math.round(p * l.quantite * 100) / 100 });
                            }}
                            aria-label="Prix unitaire TTC"
                          />
                        </div>
                        {cible !== AUCUNE && (
                          <Select value={l.cibleId || "ignorer"} onValueChange={(v) => maj(l.cle, { cibleId: v === "ignorer" ? "" : v })}>
                            <SelectTrigger aria-label="Ligne à renseigner" className={l.cibleId ? "" : "text-muted-foreground"}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ignorer">— Ne pas rattacher —</SelectItem>
                              {options.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.libelle}
                                  {o.detail ? ` ${o.detail}` : ""}
                                  {o.prixActuel !== null ? ` (PA actuel ${formatEuros(o.prixActuel)})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {option && option.prixActuel !== null && option.prixActuel !== l.prixUnitaire && (
                          <p className="text-xs text-amber-700 dark:text-amber-400">Remplacera le prix d&apos;achat actuel ({formatEuros(option.prixActuel)}).</p>
                        )}
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label="Retirer" onClick={() => setLignes((cur) => (cur ?? []).filter((x) => x.cle !== l.cle))}>
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {retenues.length} ligne{retenues.length > 1 ? "s" : ""} retenue{retenues.length > 1 ? "s" : ""} · {formatEuros(totalRetenu)}
                {lecture?.totalTtc != null && Math.abs(totalRetenu - lecture.totalTtc) > 0.011 ? ` (total lu ${formatEuros(lecture.totalTtc)})` : ""}
              </span>
              {cible === AUCUNE && <span>Choisissez où rattacher les achats.</span>}
            </div>

            <Button type="button" size="lg" className="w-full" onClick={appliquer} disabled={envoi || pretes.length === 0}>
              {envoi ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Renseigner {pretes.length} prix d&apos;achat
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
