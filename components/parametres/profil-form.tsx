"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { upsertProfil } from "@/lib/actions/profil";
import {
  profilSchema,
  type ProfilFormValues,
} from "@/lib/validations/profil";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { Database } from "@/types/database";

type Profil = Database["public"]["Tables"]["profil_entreprise"]["Row"];

/**
 * Formulaire de profil entreprise. Sectionné en 8 cards thématiques :
 * Identité, Identifiants légaux, Adresse, Contact, BTP/Décennale,
 * Clim/PAC, Banque, Médiateur. Plus une section libellés par défaut.
 */
export function ProfilForm({ profil }: { profil: Profil | null }) {
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfilFormValues>({
    resolver: zodResolver(profilSchema),
    defaultValues: {
      nom: profil?.nom ?? "",
      prenom: profil?.prenom ?? "",
      nom_commercial: profil?.nom_commercial ?? "",
      siret: profil?.siret ?? "",
      code_ape: profil?.code_ape ?? "",
      num_rm: profil?.num_rm ?? "",
      adresse_ligne1: profil?.adresse_ligne1 ?? "",
      adresse_ligne2: profil?.adresse_ligne2 ?? "",
      code_postal: profil?.code_postal ?? "",
      ville: profil?.ville ?? "",
      pays: profil?.pays ?? "France",
      email_pro: profil?.email_pro ?? "",
      telephone: profil?.telephone ?? "",
      site_web: profil?.site_web ?? "",
      num_assurance_decennale: profil?.num_assurance_decennale ?? "",
      assureur_decennale: profil?.assureur_decennale ?? "",
      assureur_decennale_adresse: profil?.assureur_decennale_adresse ?? "",
      decennale_valide_jusquau: profil?.decennale_valide_jusquau ?? "",
      decennale_activites: profil?.decennale_activites ?? "",
      fluides_valide_jusquau: profil?.fluides_valide_jusquau ?? "",
      zone_couverture_decennale:
        profil?.zone_couverture_decennale ?? "France métropolitaine",
      num_attestation_fluides_frigo: profil?.num_attestation_fluides_frigo ?? "",
      num_rge_qualipac: profil?.num_rge_qualipac ?? "",
      iban: profil?.iban ?? "",
      bic: profil?.bic ?? "",
      banque_nom: profil?.banque_nom ?? "",
      mediateur_nom: profil?.mediateur_nom ?? "",
      mediateur_site_web: profil?.mediateur_site_web ?? "",
      mediateur_adresse: profil?.mediateur_adresse ?? "",
      conditions_paiement_default: profil?.conditions_paiement_default ?? "",
      penalites_retard_text: profil?.penalites_retard_text ?? "",
      escompte_text: profil?.escompte_text ?? "",
    },
  });

  async function onSubmit(values: ProfilFormValues) {
    setSubmitting(true);
    const result = await upsertProfil(values);
    setSubmitting(false);

    if (result.ok) {
      toast.success("Profil enregistré");
    } else {
      toast.error("Échec de l'enregistrement", { description: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Identité */}
      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
          <CardDescription>
            Votre nom et celui sous lequel vous communiquez (optionnel).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Prénom" id="prenom" error={errors.prenom?.message}>
            <Input id="prenom" {...register("prenom")} />
          </Field>
          <Field label="Nom" id="nom" error={errors.nom?.message}>
            <Input id="nom" {...register("nom")} />
          </Field>
          <Field
            label="Nom commercial"
            id="nom_commercial"
            error={errors.nom_commercial?.message}
            className="md:col-span-2"
            help="Si vous exercez sous une enseigne différente de votre nom."
          >
            <Input id="nom_commercial" {...register("nom_commercial")} />
          </Field>
        </CardContent>
      </Card>

      {/* Identifiants légaux */}
      <Card>
        <CardHeader>
          <CardTitle>Identifiants légaux</CardTitle>
          <CardDescription>
            Le SIRET, le code APE et l'inscription au Répertoire des Métiers
            apparaissent obligatoirement sur vos factures BTP.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="SIRET"
            id="siret"
            error={errors.siret?.message}
            help="14 chiffres. Le SIREN sera dérivé automatiquement."
          >
            <Input
              id="siret"
              inputMode="numeric"
              placeholder="123 456 789 00012"
              {...register("siret")}
            />
          </Field>
          <Field
            label="Code APE / NAF"
            id="code_ape"
            error={errors.code_ape?.message}
            help="Ex: 4322A pour la plomberie."
          >
            <Input id="code_ape" placeholder="4322A" {...register("code_ape")} />
          </Field>
          <Field
            label="Numéro RM"
            id="num_rm"
            error={errors.num_rm?.message}
            help="Inscription au Répertoire des Métiers (CMA)."
            className="md:col-span-2"
          >
            <Input id="num_rm" {...register("num_rm")} />
          </Field>
        </CardContent>
      </Card>

      {/* Adresse */}
      <Card>
        <CardHeader>
          <CardTitle>Adresse professionnelle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="Adresse"
            id="adresse_ligne1"
            error={errors.adresse_ligne1?.message}
            className="md:col-span-2"
          >
            <Input id="adresse_ligne1" {...register("adresse_ligne1")} />
          </Field>
          <Field
            label="Complément d'adresse"
            id="adresse_ligne2"
            error={errors.adresse_ligne2?.message}
            className="md:col-span-2"
          >
            <Input id="adresse_ligne2" {...register("adresse_ligne2")} />
          </Field>
          <Field
            label="Code postal"
            id="code_postal"
            error={errors.code_postal?.message}
          >
            <Input
              id="code_postal"
              inputMode="numeric"
              maxLength={5}
              {...register("code_postal")}
            />
          </Field>
          <Field label="Ville" id="ville" error={errors.ville?.message}>
            <Input id="ville" {...register("ville")} />
          </Field>
          <Field
            label="Pays"
            id="pays"
            error={errors.pays?.message}
            className="md:col-span-2"
          >
            <Input id="pays" {...register("pays")} />
          </Field>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="Email professionnel"
            id="email_pro"
            error={errors.email_pro?.message}
          >
            <Input
              id="email_pro"
              type="email"
              autoComplete="email"
              {...register("email_pro")}
            />
          </Field>
          <Field
            label="Téléphone"
            id="telephone"
            error={errors.telephone?.message}
            help="Format FR : 06 12 34 56 78 ou +33 6 12 34 56 78."
          >
            <Input id="telephone" {...register("telephone")} />
          </Field>
          <Field
            label="Site web"
            id="site_web"
            error={errors.site_web?.message}
            className="md:col-span-2"
          >
            <Input
              id="site_web"
              type="url"
              placeholder="https://..."
              {...register("site_web")}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Décennale */}
      <Card>
        <CardHeader>
          <CardTitle>Assurance décennale (BTP)</CardTitle>
          <CardDescription>
            Mention obligatoire sur toutes vos factures et devis BTP.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="Numéro de police"
            id="num_assurance_decennale"
            error={errors.num_assurance_decennale?.message}
          >
            <Input
              id="num_assurance_decennale"
              {...register("num_assurance_decennale")}
            />
          </Field>
          <Field
            label="Compagnie d'assurance"
            id="assureur_decennale"
            error={errors.assureur_decennale?.message}
          >
            <Input
              id="assureur_decennale"
              {...register("assureur_decennale")}
            />
          </Field>
          <Field
            label="Coordonnées de l'assureur (adresse)"
            id="assureur_decennale_adresse"
            error={errors.assureur_decennale_adresse?.message}
            className="md:col-span-2"
            help="Mention obligatoire sur devis et factures de travaux (art. 22-2, loi 96-603)."
          >
            <Input
              id="assureur_decennale_adresse"
              placeholder="ex. 12 rue de la Paix, 75002 Paris"
              {...register("assureur_decennale_adresse")}
            />
          </Field>
          <Field
            label="Zone géographique de couverture"
            id="zone_couverture_decennale"
            error={errors.zone_couverture_decennale?.message}
            className="md:col-span-2"
          >
            <Input
              id="zone_couverture_decennale"
              {...register("zone_couverture_decennale")}
            />
          </Field>
          <Field
            label="Attestation valide jusqu'au"
            id="decennale_valide_jusquau"
            error={errors.decennale_valide_jusquau?.message}
            help="Alerte sur le tableau de bord 30 jours avant l'échéance."
          >
            <Input
              id="decennale_valide_jusquau"
              type="date"
              {...register("decennale_valide_jusquau")}
            />
          </Field>
          <Field
            label="Activités couvertes"
            id="decennale_activites"
            error={errors.decennale_activites?.message}
            help="Ex. 5.1 Plomberie, 5.2 Génie climatique/PAC, 5.4 Aéraulique."
          >
            <Input
              id="decennale_activites"
              {...register("decennale_activites")}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Clim/PAC */}
      <Card>
        <CardHeader>
          <CardTitle>Climatisation / Pompes à chaleur</CardTitle>
          <CardDescription>
            Attestation de capacité fluides frigorigènes (catégorie I) — obligatoire
            pour intervenir sur les installations frigorifiques. Numéro RGE
            QualiPAC si vous l'avez.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="N° attestation fluides frigorigènes"
            id="num_attestation_fluides_frigo"
            error={errors.num_attestation_fluides_frigo?.message}
          >
            <Input
              id="num_attestation_fluides_frigo"
              {...register("num_attestation_fluides_frigo")}
            />
          </Field>
          <Field
            label="Attestation fluides valide jusqu'au"
            id="fluides_valide_jusquau"
            error={errors.fluides_valide_jusquau?.message}
            help="Même alerte que la décennale : 30 jours avant l'échéance."
          >
            <Input
              id="fluides_valide_jusquau"
              type="date"
              {...register("fluides_valide_jusquau")}
            />
          </Field>
          <Field
            label="N° RGE QualiPAC (optionnel)"
            id="num_rge_qualipac"
            error={errors.num_rge_qualipac?.message}
          >
            <Input id="num_rge_qualipac" {...register("num_rge_qualipac")} />
          </Field>
        </CardContent>
      </Card>

      {/* Banque */}
      <Card>
        <CardHeader>
          <CardTitle>Coordonnées bancaires</CardTitle>
          <CardDescription>
            Apparaissent sur vos factures pour permettre le règlement par virement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="IBAN"
            id="iban"
            error={errors.iban?.message}
            className="md:col-span-2"
            help="Format FR : FR76 XXXX XXXX XXXX XXXX XXXX XXX."
          >
            <Input
              id="iban"
              placeholder="FR76 1234 5678 9012 3456 7890 123"
              {...register("iban")}
            />
          </Field>
          <Field label="BIC" id="bic" error={errors.bic?.message}>
            <Input id="bic" {...register("bic")} />
          </Field>
          <Field
            label="Banque"
            id="banque_nom"
            error={errors.banque_nom?.message}
          >
            <Input id="banque_nom" {...register("banque_nom")} />
          </Field>
        </CardContent>
      </Card>

      {/* Médiateur */}
      <Card>
        <CardHeader>
          <CardTitle>Médiateur de la consommation</CardTitle>
          <CardDescription>
            Obligatoire pour les clients particuliers — vous devez avoir
            désigné un médiateur de la consommation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field
            label="Nom du médiateur"
            id="mediateur_nom"
            error={errors.mediateur_nom?.message}
          >
            <Input id="mediateur_nom" {...register("mediateur_nom")} />
          </Field>
          <Field
            label="Site web du médiateur"
            id="mediateur_site_web"
            error={errors.mediateur_site_web?.message}
          >
            <Input
              id="mediateur_site_web"
              type="url"
              placeholder="https://..."
              {...register("mediateur_site_web")}
            />
          </Field>
          <Field
            label="Adresse postale"
            id="mediateur_adresse"
            error={errors.mediateur_adresse?.message}
            className="md:col-span-2"
          >
            <Textarea
              id="mediateur_adresse"
              rows={2}
              {...register("mediateur_adresse")}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Mentions par défaut */}
      <Card>
        <CardHeader>
          <CardTitle>Mentions par défaut sur vos documents</CardTitle>
          <CardDescription>
            Pré-remplis avec les valeurs légales standard. Vous pouvez les
            personnaliser, ils apparaîtront sur vos factures et devis.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            label="Conditions de paiement"
            id="conditions_paiement_default"
            error={errors.conditions_paiement_default?.message}
          >
            <Textarea
              id="conditions_paiement_default"
              rows={2}
              {...register("conditions_paiement_default")}
            />
          </Field>
          <Field
            label="Pénalités de retard"
            id="penalites_retard_text"
            error={errors.penalites_retard_text?.message}
            help="Mention légale (art. L441-10 et D441-5 du Code de commerce)."
          >
            <Textarea
              id="penalites_retard_text"
              rows={4}
              {...register("penalites_retard_text")}
            />
          </Field>
          <Field
            label="Escompte"
            id="escompte_text"
            error={errors.escompte_text?.message}
          >
            <Input id="escompte_text" {...register("escompte_text")} />
          </Field>
        </CardContent>
      </Card>

      {/* Action sticky en bas */}
      <div className="sticky bottom-0 -mx-6 flex justify-end border-t bg-background/95 px-6 py-4 backdrop-blur">
        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Sauvegarder
        </Button>
      </div>
    </form>
  );
}

/**
 * Wrapper d'un champ : label + input + erreur + aide.
 */
function Field({
  label,
  id,
  error,
  help,
  className,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  help?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {help && !error && (
        <p className="text-xs text-muted-foreground">{help}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
