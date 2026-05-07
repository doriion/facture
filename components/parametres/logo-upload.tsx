"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { removeLogo, uploadLogo } from "@/lib/actions/profil";

/**
 * Composant d'upload du logo (PNG/JPG/SVG/WebP, max 2 Mo).
 * Reçoit l'URL signée actuelle. Délègue les opérations aux server actions.
 */
export function LogoUpload({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isRemoving, setIsRemoving] = useState(false);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadLogo(formData);
      if (result.ok) {
        toast.success("Logo mis à jour");
      } else {
        toast.error("Échec de l'upload", { description: result.error });
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  async function onRemove() {
    setIsRemoving(true);
    const result = await removeLogo();
    if (result.ok) {
      toast.success("Logo supprimé");
    } else {
      toast.error("Échec de la suppression", { description: result.error });
    }
    setIsRemoving(false);
  }

  return (
    <div className="flex items-start gap-6">
      <div className="flex size-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
        {currentLogoUrl ? (
          <Image
            src={currentLogoUrl}
            alt="Logo"
            width={128}
            height={128}
            className="object-contain"
            unoptimized
          />
        ) : (
          <span className="text-xs text-muted-foreground">Aucun logo</span>
        )}
      </div>
      <div className="flex-1 space-y-2">
        <p className="text-sm text-muted-foreground">
          Format PNG, JPG, SVG ou WebP — 2 Mo maximum. Votre logo apparaîtra
          sur les factures et devis.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {currentLogoUrl ? "Remplacer" : "Téléverser"}
          </Button>
          {currentLogoUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRemove}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Supprimer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
