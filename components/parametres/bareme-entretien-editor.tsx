"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deletePosteBaremeAction,
  deleteZoneBaremeAction,
  savePosteBaremeAction,
  saveReglagesBaremeAction,
  saveZoneBaremeAction,
  type PosteSaisi,
  type ZoneSaisie,
} from "@/lib/actions/bareme-entretien";
import {
  GROUPES_BAREME,
  coutZone,
  libelleTranche,
  trierTranches,
  type BaremeEntretien,
  type GroupeBareme,
  type PosteBareme,
  type ZoneBareme,
} from "@/lib/bareme-entretien";
import { formatEuros } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fr = (n: number) => String(n).replace(".", ",");

/**
 * Réglages du barème d'entretien : postes (prix dégressifs par
 * tranche), zones de déplacement et paramètres du déplacement. Tout
 * est modifiable ici, rien n'est codé en dur dans le calculateur.
 */
export function BaremeEntretienEditor({ bareme }: { bareme: BaremeEntretien }) {
  return (
    <div className="space-y-6">
      <PostesCard postes={bareme.postes} />
      <ZonesCard zones={bareme.zones} reglages={bareme.reglages} />
      <ReglagesCard reglages={bareme.reglages} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Postes
// ---------------------------------------------------------------------------

type PosteEdit = Omit<PosteSaisi, "tranches"> & {
  tranches: Array<{ a_partir_de: string; prix: string }>;
};

function PostesCard({ postes }: { postes: PosteBareme[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<PosteEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function nouveau() {
    setEdit({
      groupe: "split",
      libelle: "",
      unite: "unité",
      tranches: [{ a_partir_de: "1", prix: "" }],
      actif: true,
    });
  }

  function modifier(p: PosteBareme) {
    setEdit({
      id: p.id,
      groupe: p.groupe,
      libelle: p.libelle,
      unite: p.unite,
      tranches: trierTranches(p.tranches).map((t) => ({
        a_partir_de: String(t.a_partir_de),
        prix: fr(t.prix),
      })),
      actif: p.actif,
    });
  }

  async function enregistrer() {
    if (!edit) return;
    setSaving(true);
    const res = await savePosteBaremeAction(edit);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Poste enregistré.");
    setEdit(null);
    router.refresh();
  }

  async function supprimer(p: PosteBareme) {
    if (!p.id) return;
    setDeletingId(p.id);
    const res = await deletePosteBaremeAction(p.id);
    setDeletingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`« ${p.libelle} » supprimé.`);
    router.refresh();
  }

  const groupes = (Object.keys(GROUPES_BAREME) as GroupeBareme[]).map((g) => ({
    groupe: g,
    postes: postes.filter((p) => p.groupe === g),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Postes et tarifs</CardTitle>
        <CardDescription>
          Prix unitaire net par tranche de quantité : le total d&apos;un poste
          est le prix de la tranche atteinte × le nombre d&apos;unités. Un
          poste désactivé n&apos;est plus proposé dans le calculateur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupes.map(({ groupe, postes: liste }) => (
          <div key={groupe} className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {GROUPES_BAREME[groupe]}
            </h3>
            <div className="divide-y rounded-md border">
              {liste.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">Aucun poste.</p>
              )}
              {liste.map((p) => {
                const tranches = trierTranches(p.tranches);
                return (
                  <div
                    key={p.code}
                    className={`flex items-center gap-3 px-3 py-2 ${p.actif ? "" : "opacity-50"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {p.libelle}
                        {!p.actif && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            désactivé
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs tabular-nums text-muted-foreground">
                        {tranches
                          .map((t, i) => `${libelleTranche(tranches, i)} : ${formatEuros(t.prix)}`)
                          .join(" · ")}
                        {p.unite !== "unité" ? ` / ${p.unite}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => modifier(p)}
                      title="Modifier"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => supprimer(p)}
                      disabled={deletingId === p.id}
                      title="Supprimer"
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={nouveau}>
          <Plus className="size-4" />
          Ajouter un poste
        </Button>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifier le poste" : "Nouveau poste"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="poste-libelle">Libellé</Label>
                <Input
                  id="poste-libelle"
                  value={edit.libelle}
                  onChange={(e) => setEdit({ ...edit, libelle: e.target.value })}
                  placeholder="ex. Split réversible / PAC air-air"
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Catégorie</Label>
                  <Select
                    value={edit.groupe}
                    onValueChange={(v) => setEdit({ ...edit, groupe: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(GROUPES_BAREME) as GroupeBareme[]).map((g) => (
                        <SelectItem key={g} value={g}>
                          {GROUPES_BAREME[g]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="poste-unite">Unité</Label>
                  <Input
                    id="poste-unite"
                    value={edit.unite}
                    onChange={(e) => setEdit({ ...edit, unite: e.target.value })}
                    placeholder="unité, filtre…"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tranches (prix unitaire net)</Label>
                <div className="space-y-2">
                  {edit.tranches.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-muted-foreground">À partir de</span>
                      <Input
                        inputMode="numeric"
                        className="w-20 text-right"
                        value={t.a_partir_de}
                        onChange={(e) => {
                          const tranches = [...edit.tranches];
                          tranches[i] = { ...t, a_partir_de: e.target.value };
                          setEdit({ ...edit, tranches });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">unité(s) :</span>
                      <Input
                        inputMode="decimal"
                        className="w-28 text-right"
                        placeholder="0,00"
                        value={t.prix}
                        onChange={(e) => {
                          const tranches = [...edit.tranches];
                          tranches[i] = { ...t, prix: e.target.value };
                          setEdit({ ...edit, tranches });
                        }}
                      />
                      <span className="text-xs text-muted-foreground">€</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={edit.tranches.length === 1}
                        onClick={() =>
                          setEdit({
                            ...edit,
                            tranches: edit.tranches.filter((_, j) => j !== i),
                          })
                        }
                        title="Retirer la tranche"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setEdit({
                      ...edit,
                      tranches: [...edit.tranches, { a_partir_de: "", prix: "" }],
                    })
                  }
                >
                  <Plus className="size-3.5" />
                  Ajouter une tranche
                </Button>
                <p className="text-xs text-muted-foreground">
                  La première tranche commence à 1. Ex. : 1 → 189 €, 2 → 146 €,
                  6 → 105 €.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={edit.actif}
                  onChange={(e) => setEdit({ ...edit, actif: e.target.checked })}
                />
                Proposé dans le calculateur
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={enregistrer} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

function ZonesCard({
  zones,
  reglages,
}: {
  zones: ZoneBareme[];
  reglages: BaremeEntretien["reglages"];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<ZoneSaisie | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function enregistrer() {
    if (!edit) return;
    setSaving(true);
    const res = await saveZoneBaremeAction(edit);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Zone enregistrée.");
    setEdit(null);
    router.refresh();
  }

  async function supprimer(z: ZoneBareme) {
    if (!z.id) return;
    setDeletingId(z.id);
    const res = await deleteZoneBaremeAction(z.id);
    setDeletingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Zone « ${z.libelle} » supprimée.`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zones de déplacement</CardTitle>
        <CardDescription>
          Forfait = distance aller-retour × tarif au km + péage + temps de
          route × taux horaire (réglages ci-dessous). Recalculé automatiquement
          quand vous changez un réglage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="divide-y rounded-md border">
          {zones.map((z) => {
            const c = coutZone(z, reglages);
            return (
              <div
                key={z.code}
                className={`flex items-center gap-3 px-3 py-2 ${z.actif ? "" : "opacity-50"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{z.libelle}</p>
                  <p className="truncate text-xs tabular-nums text-muted-foreground">
                    {z.distance_km} km A/R · péage {formatEuros(z.peage)} · {z.temps_route_h} h
                    de route
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">{formatEuros(c.total)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Modifier"
                  onClick={() =>
                    setEdit({
                      id: z.id,
                      libelle: z.libelle,
                      distance_km: fr(z.distance_km),
                      peage: fr(z.peage),
                      temps_route_h: fr(z.temps_route_h),
                      actif: z.actif,
                    })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  title="Supprimer"
                  disabled={deletingId === z.id}
                  onClick={() => supprimer(z)}
                >
                  {deletingId === z.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setEdit({ libelle: "", distance_km: "", peage: "", temps_route_h: "", actif: true })
          }
        >
          <Plus className="size-4" />
          Ajouter une zone
        </Button>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Modifier la zone" : "Nouvelle zone"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="zone-libelle">Nom de la zone</Label>
                <Input
                  id="zone-libelle"
                  value={edit.libelle}
                  onChange={(e) => setEdit({ ...edit, libelle: e.target.value })}
                  placeholder="ex. Voiron"
                  autoFocus
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="zone-km">Distance A/R (km)</Label>
                  <Input
                    id="zone-km"
                    inputMode="decimal"
                    value={String(edit.distance_km)}
                    onChange={(e) => setEdit({ ...edit, distance_km: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zone-peage">Péage A/R (€)</Label>
                  <Input
                    id="zone-peage"
                    inputMode="decimal"
                    value={String(edit.peage)}
                    onChange={(e) => setEdit({ ...edit, peage: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="zone-h">Temps de route (h)</Label>
                  <Input
                    id="zone-h"
                    inputMode="decimal"
                    value={String(edit.temps_route_h)}
                    onChange={(e) => setEdit({ ...edit, temps_route_h: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={edit.actif}
                  onChange={(e) => setEdit({ ...edit, actif: e.target.checked })}
                />
                Proposée dans le calculateur
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={enregistrer} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Réglages du déplacement
// ---------------------------------------------------------------------------

function ReglagesCard({ reglages }: { reglages: BaremeEntretien["reglages"] }) {
  const router = useRouter();
  const [tarifKm, setTarifKm] = useState(fr(reglages.tarif_km));
  const [tauxHoraire, setTauxHoraire] = useState(fr(reglages.taux_horaire));
  const [saving, setSaving] = useState(false);

  async function enregistrer() {
    setSaving(true);
    const res = await saveReglagesBaremeAction({ tarif_km: tarifKm, taux_horaire: tauxHoraire });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Réglages enregistrés — forfaits de déplacement recalculés.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réglages du déplacement</CardTitle>
        <CardDescription>
          Appliqués à toutes les zones. Montants nets, sans TVA.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tarif-km">Tarif au km (€)</Label>
          <Input
            id="tarif-km"
            inputMode="decimal"
            className="w-28"
            value={tarifKm}
            onChange={(e) => setTarifKm(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taux-h">Taux horaire de route (€/h)</Label>
          <Input
            id="taux-h"
            inputMode="decimal"
            className="w-28"
            value={tauxHoraire}
            onChange={(e) => setTauxHoraire(e.target.value)}
          />
        </div>
        <Button onClick={enregistrer} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}
