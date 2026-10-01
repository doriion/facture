"use client";

import { useEffect, useState } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * « Partager… » : la feuille de partage du téléphone (SMS, WhatsApp,
 * Mail, AirDrop…) avec le PDF en pièce jointe — le geste naturel sur le
 * chantier, au lieu de télécharger puis partager depuis Safari. Rendu
 * seulement si le navigateur sait partager un fichier (iPhone, Android) ;
 * sur PC, rien n'apparaît, « Télécharger PDF » suffit.
 */
export function PartagerPdfButton({
  url,
  nomFichier,
  titre,
  variant = "outline",
}: {
  /** Route qui produit le PDF (même origine). */
  url: string;
  nomFichier: string;
  titre: string;
  variant?: "default" | "outline";
}) {
  const [disponible, setDisponible] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    setDisponible(
      typeof navigator.share === "function" && typeof navigator.canShare === "function",
    );
  }, []);

  if (!disponible) return null;

  async function partager() {
    setEnCours(true);
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) {
        const texte = await reponse.text().catch(() => "");
        throw new Error(texte.trim() || `Le PDF n'a pas pu être produit (${reponse.status}).`);
      }
      const fichier = new File([await reponse.blob()], nomFichier, { type: "application/pdf" });
      if (!navigator.canShare({ files: [fichier] })) {
        // Fichiers non partageables : le visualiseur natif propose le partage.
        window.open(url, "_blank", "noopener");
        return;
      }
      await navigator.share({ files: [fichier], title: titre });
    } catch (e) {
      const erreur = e as { name?: string; message?: string };
      if (erreur.name === "AbortError") return; // partage annulé par l'utilisateur
      toast.error("Partage impossible", {
        description:
          erreur.name === "NotAllowedError"
            ? "Réessayez en appuyant à nouveau sur « Partager » : le téléphone demande un geste direct."
            : erreur.message || "Utilisez « Télécharger PDF » puis le partage du visualiseur.",
      });
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Button variant={variant} onClick={partager} disabled={enCours}>
      {enCours ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
      Partager…
    </Button>
  );
}
