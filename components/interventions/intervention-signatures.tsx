"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

import {
  uploadInterventionSignatureAction,
  type InterventionSignature,
} from "@/lib/actions/signatures";
import { appelerOuMettreEnAttente } from "@/lib/appel-action";
import { genererId } from "@/lib/file-attente-helpers";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/interventions/signature-pad";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateFr } from "@/lib/format";

const ROLE_LABELS = {
  operateur: {
    titre: "Opérateur (vous)",
    qualitePlaceholder: "Ex : Gérant — attestation fluides",
  },
  detenteur: {
    titre: "Détenteur / client",
    qualitePlaceholder: "Ex : Propriétaire de l'équipement",
  },
} as const;

function SignatureBlock({
  interventionId,
  role,
  signature,
  defaultNom,
}: {
  interventionId: string;
  role: "operateur" | "detenteur";
  signature: InterventionSignature | null;
  defaultNom?: string;
}) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [mode, setMode] = useState<"view" | "sign">(
    signature ? "view" : "sign",
  );
  const [nom, setNom] = useState(defaultNom ?? "");
  const [qualite, setQualite] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!padRef.current) return;
    const blob = await padRef.current.toBlob();
    if (!blob) {
      toast.error("Impossible d'exporter la signature.");
      return;
    }
    setSaving(true);
    // Signature faite sur place : sans réseau (cave, sous-sol), elle est
    // mise en file avec son identifiant et partira au retour du réseau —
    // le client n'a pas à re-signer.
    const signatureId = genererId();
    const file = new File([blob], "signature.png", { type: "image/png" });
    const fd = new FormData();
    fd.append("id", signatureId);
    fd.append("file", file);
    fd.append("role", role);
    fd.append("nom", nom);
    fd.append("qualite", qualite);
    try {
      const res = await appelerOuMettreEnAttente(
        {
          id: signatureId,
          type: "signature_intervention",
          payload: { interventionId, file, role, nom, qualite },
        },
        () => uploadInterventionSignatureAction(interventionId, fd),
      );
      if (!res.ok) {
        toast.error("Erreur", { description: res.error });
        return;
      }
      if ("enAttente" in res) {
        toast.success("Signature mise en attente", {
          description: "Pas de réseau : elle partira toute seule au retour de la connexion.",
        });
        setMode("view");
        return;
      }
      toast.success("Signature enregistrée", {
        description: "Elle est figée : re-signer créera une nouvelle version.",
      });
      setMode("view");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const labels = ROLE_LABELS[role];

  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{labels.titre}</p>
        {signature && mode === "view" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode("sign")}
          >
            <PenLine className="size-4" />
            Re-signer
          </Button>
        )}
      </div>

      {mode === "view" && signature ? (
        <div className="space-y-2">
          {signature.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signature.url}
              alt={`Signature ${signature.signataire_nom}`}
              className="h-24 w-full rounded-md border bg-white object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">URL expirée.</p>
          )}
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">
              {signature.signataire_nom}
            </strong>
            {signature.signataire_qualite && (
              <> — {signature.signataire_qualite}</>
            )}{" "}
            · signé le {formatDateFr(signature.signe_le)}
            {signature.versions > 1 && (
              <> · version {signature.versions} (historique conservé)</>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`sig-nom-${role}`}>Nom du signataire *</Label>
              <Input
                id={`sig-nom-${role}`}
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Prénom Nom"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`sig-qualite-${role}`}>Qualité</Label>
              <Input
                id={`sig-qualite-${role}`}
                value={qualite}
                onChange={(e) => setQualite(e.target.value)}
                placeholder={labels.qualitePlaceholder}
              />
            </div>
          </div>
          <SignaturePad padRef={padRef} onInkChange={setHasInk} disabled={saving} />
          <div className="flex justify-end gap-2">
            {signature && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("view")}
                disabled={saving}
              >
                Annuler
              </Button>
            )}
            <Button
              type="button"
              onClick={onSave}
              disabled={saving || !hasInk || !nom.trim()}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PenLine className="size-4" />
              )}
              Enregistrer la signature
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Blocs de signature opérateur + détenteur d'une intervention.
 * Une signature enregistrée est IMMUABLE (aucune modification possible
 * côté base ni storage) — « Re-signer » crée une nouvelle version
 * datée, et l'historique est conservé. La dernière version de chaque
 * rôle est intégrée au CERFA 15497 généré.
 */
export function InterventionSignatures({
  interventionId,
  operateur,
  detenteur,
  operateurNom,
}: {
  interventionId: string;
  operateur: InterventionSignature | null;
  detenteur: InterventionSignature | null;
  operateurNom?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PenLine className="size-4 text-primary" />
          Signatures
        </CardTitle>
        <CardDescription>
          Signatures au doigt de l&apos;opérateur et du détenteur, reprises
          sur le CERFA 15497. Une signature enregistrée n&apos;est pas
          modifiable (valeur probante) — re-signer crée une nouvelle
          version datée.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <SignatureBlock
          interventionId={interventionId}
          role="operateur"
          signature={operateur}
          defaultNom={operateurNom}
        />
        <SignatureBlock
          interventionId={interventionId}
          role="detenteur"
          signature={detenteur}
        />
      </CardContent>
    </Card>
  );
}
