"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTauxCotisationsAction,
  saveTauxCotisationsAction,
  type TauxCotisationsRow,
} from "@/lib/actions/cotisations";
import { tauxTotalPct } from "@/lib/cotisations";
import { formatDateFr } from "@/lib/format";
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

type EditState = {
  id?: string;
  date_debut: string;
  libelle: string;
  taux_social: string;
  taux_cfp: string;
  taux_vl: string;
};

/**
 * Barème de cotisations daté (table taux_cotisations) : une ligne par
 * période de taux — ACRE puis taux plein. Alimente la carte
 * « Cotisations à provisionner » du tableau de bord. Les taux sont
 * fournis par les notifications URSSAF de l'utilisateur, pas déduits.
 */
export function TauxCotisationsCard({
  bareme,
}: {
  bareme: TauxCotisationsRow[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openNew() {
    setEdit({
      date_debut: "",
      libelle: "",
      taux_social: "",
      taux_cfp: "0,3",
      taux_vl: "1,7",
    });
  }

  function openEdit(row: TauxCotisationsRow) {
    setEdit({
      id: row.id,
      date_debut: row.date_debut,
      libelle: row.libelle,
      taux_social: String(row.taux_social).replace(".", ","),
      taux_cfp: String(row.taux_cfp).replace(".", ","),
      taux_vl: String(row.taux_vl).replace(".", ","),
    });
  }

  async function onSave() {
    if (!edit) return;
    setSaving(true);
    const res = await saveTauxCotisationsAction(edit);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Barème enregistré.");
    setEdit(null);
    router.refresh();
  }

  async function onDelete(id: string) {
    setDeletingId(id);
    const res = await deleteTauxCotisationsAction(id);
    setDeletingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Ligne supprimée.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taux de cotisations</CardTitle>
        <CardDescription>
          Une ligne par période : le tableau de bord applique le taux en
          vigueur à la date du jour (ACRE, puis taux plein). Reportez les
          taux de vos notifications URSSAF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="divide-y rounded-md border">
          {bareme.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              Aucune ligne — le barème par défaut sera créé au prochain
              affichage du tableau de bord.
            </p>
          )}
          {bareme.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-2 p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  À partir du {formatDateFr(row.date_debut)} —{" "}
                  {tauxTotalPct(row).toLocaleString("fr-FR")} %
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.libelle} · social{" "}
                  {row.taux_social.toLocaleString("fr-FR")} % + CFP{" "}
                  {row.taux_cfp.toLocaleString("fr-FR")} % + VL{" "}
                  {row.taux_vl.toLocaleString("fr-FR")} %
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(row)}
                  aria-label="Modifier"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(row.id)}
                  disabled={deletingId === row.id}
                  aria-label="Supprimer"
                >
                  {deletingId === row.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openNew}>
          <Plus className="size-4" />
          Ajouter une période
        </Button>
      </CardContent>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Modifier la période" : "Nouvelle période de taux"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tc-date">Date d&apos;effet *</Label>
                  <Input
                    id="tc-date"
                    type="date"
                    value={edit.date_debut}
                    onChange={(e) =>
                      setEdit({ ...edit, date_debut: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tc-libelle">Libellé</Label>
                  <Input
                    id="tc-libelle"
                    placeholder="ACRE, taux plein…"
                    value={edit.libelle}
                    onChange={(e) =>
                      setEdit({ ...edit, libelle: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tc-social">Social (%)</Label>
                  <Input
                    id="tc-social"
                    inputMode="decimal"
                    value={edit.taux_social}
                    onChange={(e) =>
                      setEdit({ ...edit, taux_social: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tc-cfp">CFP (%)</Label>
                  <Input
                    id="tc-cfp"
                    inputMode="decimal"
                    value={edit.taux_cfp}
                    onChange={(e) =>
                      setEdit({ ...edit, taux_cfp: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tc-vl">Vers. libératoire (%)</Label>
                  <Input
                    id="tc-vl"
                    inputMode="decimal"
                    value={edit.taux_vl}
                    onChange={(e) =>
                      setEdit({ ...edit, taux_vl: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEdit(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
