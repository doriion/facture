"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ClipboardPaste, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { creerTourneeAction } from "@/lib/actions/tournee";
import { appelerAction } from "@/lib/appel-action";
import { compressImage } from "@/lib/image-compress";
import { parserTournee, type RdvTournee } from "@/lib/tournee";
import { LABELS_TYPE_INTERVENTION, TYPES_INTERVENTION } from "@/lib/validations/intervention";
import { libelleJour } from "@/lib/agenda-vues";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EXEMPLE = `Jeudi 12/11
OMOBONI Nicole
448 avenue Aristide Briand, 38600 Fontaine
9h

BENIC Guy 06 12 34 56 78
41 Rue Casimir Périer VIZILLE
10h30`;

type Ligne = RdvTournee & { cle: number; garder: boolean };

export function SaisieTournee({ dateParDefaut }: { dateParDefaut: string }) {
  const router = useRouter();
  const inputPhoto = useRef<HTMLInputElement | null>(null);
  const [texte, setTexte] = useState("");
  const [dateRef, setDateRef] = useState(dateParDefaut);
  const [type, setType] = useState<(typeof TYPES_INTERVENTION)[number]>("entretien");
  const [duree, setDuree] = useState("60");
  const [creerClients, setCreerClients] = useState(true);
  const [aFacturer, setAFacturer] = useState(true);
  const [ocr, setOcr] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const analyse = useMemo(() => (texte.trim() ? parserTournee(texte, { dateParDefaut: dateRef }) : []), [texte, dateRef]);

  function verifier() {
    setLignes(analyse.map((r, i) => ({ ...r, cle: i, garder: true })));
  }
  function maj(cle: number, patch: Partial<Ligne>) {
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
        else setTexte((t) => (t.trim() ? `${t.trim()}\n\n${lu}` : lu));
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      toast.error("Lecture impossible", { description: err instanceof Error && /fetch|network|load/i.test(err.message) ? "Le moteur de lecture n'a pas pu être téléchargé (réseau)." : "Réessayez avec une photo nette." });
    } finally {
      setOcr(null);
    }
  }

  async function creer() {
    const retenus = (lignes ?? []).filter((l) => l.garder && l.nom.trim());
    if (retenus.length === 0) return;
    setEnvoi(true);
    const res = await appelerAction(() =>
      creerTourneeAction({
        rdv: retenus.map(({ cle: _cle, garder: _g, ...r }) => r),
        type,
        dureeMinutes: Number(duree) || 60,
        creerClients,
        aFacturer,
      }),
    );
    setEnvoi(false);
    if (!res.ok) {
      toast.error("Création impossible", { description: res.error });
      return;
    }
    const d = res.data;
    toast.success(`${d.crees} rendez-vous créé${d.crees > 1 ? "s" : ""}`, {
      description: `${d.clientsCrees} client${d.clientsCrees > 1 ? "s" : ""} créé${d.clientsCrees > 1 ? "s" : ""}, ${d.clientsRepris} repris${d.echecs.length ? ` · ${d.echecs.length} en échec` : ""}`,
    });
    if (d.echecs.length) toast.warning("Certains rendez-vous n'ont pas été créés", { description: d.echecs.slice(0, 3).join(" ; ") });
    router.push(`/agenda?vue=liste`);
  }

  const parDate = useMemo(() => {
    const m = new Map<string, Ligne[]>();
    for (const l of lignes ?? []) m.set(l.date, [...(m.get(l.date) ?? []), l]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [lignes]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. La liste</CardTitle>
          <CardDescription>Collez le texte reçu, ou photographiez le planning (lecture sur le téléphone, rien n&apos;est envoyé ailleurs).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={10} placeholder={EXEMPLE} className="font-mono text-sm" />
          <div className="flex flex-wrap gap-2">
            <input ref={inputPhoto} type="file" accept="image/*" capture="environment" onChange={photo} className="hidden" />
            <Button type="button" variant="outline" onClick={() => inputPhoto.current?.click()} disabled={ocr !== null}>
              {ocr ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              {ocr ?? "Photographier le planning"}
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
                  toast.info("Collez le texte dans la zone ci-dessus (appui long → Coller).");
                }
              }}
            >
              <ClipboardPaste className="size-4" />
              Coller
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-date">Date si absente du texte</Label>
              <Input id="t-date" type="date" value={dateRef} onChange={(e) => setDateRef(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger id="t-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES_INTERVENTION.map((t) => (
                    <SelectItem key={t} value={t}>
                      {LABELS_TYPE_INTERVENTION[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-duree">Durée (min)</Label>
              <Input id="t-duree" inputMode="numeric" value={duree} onChange={(e) => setDuree(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Options</Label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={creerClients} onChange={(e) => setCreerClients(e.target.checked)} />
                Créer les clients
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={aFacturer} onChange={(e) => setAFacturer(e.target.checked)} />
                À facturer
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {analyse.length} rendez-vous reconnu{analyse.length > 1 ? "s" : ""}
            </p>
            <Button type="button" onClick={verifier} disabled={analyse.length === 0}>
              Vérifier la liste
            </Button>
          </div>
        </CardContent>
      </Card>

      {lignes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Vérifier, puis créer</CardTitle>
            <CardDescription>Corrigez ce qui a été mal lu, décochez ce qu&apos;il ne faut pas créer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {parDate.map(([date, items]) => (
              <section key={date} className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">{libelleJour(date, dateParDefaut)}</h3>
                <ul className="space-y-2">
                  {items.map((l) => (
                    <li key={l.cle} className={`rounded-lg border p-3 ${l.garder ? "" : "opacity-50"}`}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" className="mt-2.5 size-4 accent-primary" checked={l.garder} onChange={(e) => maj(l.cle, { garder: e.target.checked })} aria-label="Créer ce rendez-vous" />
                        <div className="grid flex-1 gap-2 sm:grid-cols-[6.5rem_5rem_1fr]">
                          <Input type="date" value={l.date} onChange={(e) => maj(l.cle, { date: e.target.value })} aria-label="Date" />
                          <Input value={l.heure ?? ""} onChange={(e) => maj(l.cle, { heure: e.target.value.trim() ? e.target.value : null })} placeholder="Heure" aria-label="Heure" />
                          <Input value={l.nom} onChange={(e) => maj(l.cle, { nom: e.target.value })} aria-label="Nom" className="font-medium" />
                          <Input value={l.adresse ?? ""} onChange={(e) => maj(l.cle, { adresse: e.target.value || null })} placeholder="Adresse" aria-label="Adresse" className="sm:col-span-2" />
                          <div className="grid grid-cols-[5rem_1fr] gap-2">
                            <Input value={l.code_postal ?? ""} onChange={(e) => maj(l.cle, { code_postal: e.target.value || null })} placeholder="CP" aria-label="Code postal" />
                            <Input value={l.ville ?? ""} onChange={(e) => maj(l.cle, { ville: e.target.value || null })} placeholder="Ville" aria-label="Ville" />
                          </div>
                          <Input value={l.telephone ?? ""} onChange={(e) => maj(l.cle, { telephone: e.target.value || null })} placeholder="Téléphone" aria-label="Téléphone" className="sm:col-span-3" />
                        </div>
                        <Button type="button" variant="ghost" size="icon" aria-label="Retirer" onClick={() => setLignes((cur) => (cur ?? []).filter((x) => x.cle !== l.cle))}>
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <Button type="button" size="lg" className="w-full" onClick={creer} disabled={envoi || (lignes ?? []).filter((l) => l.garder).length === 0}>
              {envoi ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Créer {(lignes ?? []).filter((l) => l.garder).length} rendez-vous{creerClients ? " et les clients" : ""}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
