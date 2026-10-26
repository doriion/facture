"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { joindreRetourSigneAction } from "@/lib/actions/devis-retour-signe";
import { aujourdhuiParis } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * « Joindre le devis signé reçu » : le client a signé sur papier et
 * renvoyé une photo, un scan ou un PDF. On l'archive, on note la date
 * du papier et le nom, le devis passe en « Accepté ».
 */
export function RetourSigneDialog({ devisId, numero, clientNom }: { devisId: string; numero: string; clientNom?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fichier, setFichier] = useState<File | null>(null);
  const [date, setDate] = useState(aujourdhuiParis());
  const [nom, setNom] = useState(clientNom ?? "");
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!fichier) {
      toast.error("Choisissez la photo ou le PDF du devis signé.");
      return;
    }
    setEnCours(true);
    const fd = new FormData();
    fd.set("fichier", fichier);
    fd.set("date_signature", date);
    fd.set("signataire_nom", nom);
    const res = await joindreRetourSigneAction(devisId, fd);
    setEnCours(false);
    if (!res.ok) {
      toast.error("Retour signé non enregistré", { description: res.error });
      return;
    }
    toast.success(`Devis ${numero} accepté`, { description: "Le devis signé reçu est archivé sur la fiche." });
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <FileCheck2 className="size-4" />
        Joindre le devis signé reçu
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={soumettre} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Devis {numero} signé sur papier</DialogTitle>
              <DialogDescription>
                Le client vous a renvoyé le devis signé (photo, scan ou PDF). Joignez-le : il est archivé, la date du papier fait foi, et le devis passe en « Accepté ».
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="retour-fichier">Photo ou PDF du devis signé *</Label>
              <Input
                id="retour-fichier"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                className="h-auto py-2"
              />
              <p className="text-xs text-muted-foreground">Depuis le téléphone, vous pouvez prendre la photo directement. 8 Mo maximum.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="retour-date">Date sur le devis *</Label>
                <Input id="retour-date" type="date" required value={date} max={aujourdhuiParis()} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="retour-nom">Signataire</Label>
                <Input id="retour-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom et nom" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={enCours}>
                Annuler
              </Button>
              <Button type="submit" disabled={enCours || !fichier}>
                {enCours ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}
                Enregistrer et accepter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
