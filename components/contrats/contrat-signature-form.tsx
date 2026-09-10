"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/interventions/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Formulaire public de signature — pensé pour le pouce : gros champs,
 * pad de signature plein écran, deux consentements EXPLICITES et
 * distincts (acceptation du contrat + rétractation quand elle
 * s'applique). Poste en FormData vers la route publique, qui revérifie
 * tout côté serveur.
 */
export function ContratSignatureForm({
  token,
  qualiteClient,
  retractationApplicable,
  prefill,
}: {
  token: string;
  qualiteClient: string;
  retractationApplicable: boolean;
  prefill: {
    nom?: string | null;
    adresse?: string | null;
    telephone?: string | null;
    email?: string | null;
    siret?: string | null;
  };
}) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [aDeLEncre, setADeLEncre] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const [nom, setNom] = useState(prefill.nom ?? "");
  const [adresse, setAdresse] = useState(prefill.adresse ?? "");
  const [telephone, setTelephone] = useState(prefill.telephone ?? "");
  const [email, setEmail] = useState(prefill.email ?? "");
  const [siret, setSiret] = useState(prefill.siret ?? "");
  const [occupant, setOccupant] = useState<string>("");
  const [contactSite, setContactSite] = useState("");
  const [qualiteSignataire, setQualiteSignataire] = useState("");
  const [accepteContrat, setAccepteContrat] = useState(false);
  const [accepteRetractation, setAccepteRetractation] = useState(false);

  const pret =
    nom.trim().length >= 2 &&
    adresse.trim().length >= 5 &&
    email.trim().length > 3 &&
    occupant !== "" &&
    accepteContrat &&
    (!retractationApplicable || accepteRetractation) &&
    aDeLEncre;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!pret || envoiEnCours) return;

    const blob = await padRef.current?.toBlob();
    if (!blob) {
      toast.error("Signez dans le cadre avant de valider.");
      return;
    }

    setEnvoiEnCours(true);
    try {
      const fd = new FormData();
      fd.append("nom", nom);
      fd.append("adresse", adresse);
      fd.append("telephone", telephone);
      fd.append("email", email);
      fd.append("siret", siret);
      fd.append("occupant", occupant);
      fd.append("contact_site", contactSite);
      fd.append("signataire_qualite", qualiteSignataire);
      fd.append("accepte_contrat", accepteContrat ? "oui" : "");
      fd.append("accepte_retractation", accepteRetractation ? "oui" : "");
      fd.append("signature", blob, "signature.png");

      const res = await fetch(
        `/api/public/contrats/${encodeURIComponent(token)}/signer`,
        { method: "POST", body: fd },
      );
      const corps = (await res.json()) as {
        ok: boolean;
        error?: string;
      };
      if (!res.ok || !corps.ok) {
        toast.error(corps.error ?? "La signature n'a pas pu être enregistrée.");
        setEnvoiEnCours(false);
        return;
      }
      // La page par token affiche maintenant l'écran de confirmation
      router.refresh();
    } catch {
      toast.error("Erreur réseau — vérifiez votre connexion et réessayez.");
      setEnvoiEnCours(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <h2 className="text-base font-semibold">Vos informations</h2>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="sig-nom">
            {qualiteClient === "professionnel"
              ? "Raison sociale / nom *"
              : "Nom et prénom *"}
          </Label>
          <Input
            id="sig-nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoComplete="name"
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sig-adresse">Adresse *</Label>
          <Textarea
            id="sig-adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            rows={2}
            autoComplete="street-address"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sig-tel">Téléphone</Label>
            <Input
              id="sig-tel"
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              autoComplete="tel"
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sig-email">E-mail *</Label>
            <Input
              id="sig-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="h-12 text-base"
            />
          </div>
        </div>
        {qualiteClient === "professionnel" && (
          <div className="space-y-1.5">
            <Label htmlFor="sig-siret">SIRET</Label>
            <Input
              id="sig-siret"
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              inputMode="numeric"
              className="h-12 text-base"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Vous êtes *</Label>
          <div className="flex gap-2">
            {[
              ["proprietaire", "Propriétaire"],
              ["locataire", "Locataire"],
            ].map(([valeur, label]) => (
              <button
                key={valeur}
                type="button"
                onClick={() => setOccupant(valeur)}
                className={
                  occupant === valeur
                    ? "flex-1 rounded-md border-2 border-primary bg-primary/10 px-3 py-2.5 text-sm font-medium"
                    : "flex-1 rounded-md border px-3 py-2.5 text-sm"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sig-contact">Contact sur site (si différent)</Label>
            <Input
              id="sig-contact"
              value={contactSite}
              onChange={(e) => setContactSite(e.target.value)}
              placeholder="Nom et téléphone"
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sig-qualite">
              Qualité du signataire (si société)
            </Label>
            <Input
              id="sig-qualite"
              value={qualiteSignataire}
              onChange={(e) => setQualiteSignataire(e.target.value)}
              placeholder="ex. gérant"
              className="h-12 text-base"
            />
          </div>
        </div>
      </div>

      <h2 className="pt-2 text-base font-semibold">Consentements</h2>
      <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-primary"
          checked={accepteContrat}
          onChange={(e) => setAccepteContrat(e.target.checked)}
        />
        <span>
          J'ai lu et j'accepte les termes du contrat d'entretien ci-dessus.
        </span>
      </label>
      {retractationApplicable && (
        <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            checked={accepteRetractation}
            onChange={(e) => setAccepteRetractation(e.target.checked)}
          />
          <span>
            J'ai pris connaissance de mon droit de rétractation de 14 jours
            (article 8 du contrat et formulaire en annexe).
          </span>
        </label>
      )}

      <h2 className="pt-2 text-base font-semibold">Votre signature</h2>
      <p className="text-xs text-muted-foreground">
        Signez au doigt dans le cadre ci-dessous, comme sur papier.
      </p>
      <SignaturePad padRef={padRef} onInkChange={setADeLEncre} />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => padRef.current?.clear()}
      >
        <Eraser className="size-4" />
        Effacer et recommencer
      </Button>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!pret || envoiEnCours}
      >
        {envoiEnCours ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <PenLine className="size-4" />
        )}
        {envoiEnCours ? "Enregistrement…" : "Signer le contrat"}
      </Button>
      {!pret && (
        <p className="text-center text-xs text-muted-foreground">
          Complétez les champs obligatoires, cochez
          {retractationApplicable ? " les deux cases" : " la case"} et signez
          pour activer le bouton.
        </p>
      )}
    </form>
  );
}
