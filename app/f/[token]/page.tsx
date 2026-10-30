import { CheckCircle2, ClipboardCheck, Clock, FileCheck2, FileWarning } from "lucide-react";

import { getFicheParToken } from "@/lib/fiches-gaz/public";
import { manipulationsDepuisJson, NATURES_COURTES, totauxManipulations, TYPES_EQUIPEMENT, type TypeEquipement } from "@/lib/fiches-gaz";
import { NATURES_INTERVENTION, type NatureIntervention } from "@/lib/cerfa";
import { equivalentCo2Tonnes, formatEquivalentCo2 } from "@/lib/fluides";
import { SignatureFichePubliqueForm } from "@/components/fiches-gaz/signature-fiche-publique-form";
import { LogoMarque } from "@/components/logo-marque";
import { Button } from "@/components/ui/button";
import { formatDateFr } from "@/lib/format";

export const metadata = {
  title: "Signature de la fiche d'intervention",
  // Page nominative accessible par lien : jamais indexée.
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

/**
 * Page PUBLIQUE de signature d'une fiche gaz (aucun compte) : le client
 * accède par le lien unique reçu, relit le résumé de l'intervention,
 * ouvre le CERFA et le bon de réception en PDF, indique ses réserves
 * et signe au doigt. Le jeton est résolu côté serveur (service role).
 */
export default async function SignatureFichePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const pub = await getFicheParToken(token);

  if (pub.etat === "indisponible") {
    return (
      <Coquille>
        <EtatMessage icone={<FileWarning className="size-10 text-muted-foreground" />} titre="Service momentanément indisponible" message="Impossible d'afficher la fiche pour le moment. Réessayez dans quelques minutes, ou contactez votre artisan. Votre lien reste valable." />
      </Coquille>
    );
  }
  if (pub.etat === "introuvable" || !pub.fiche) {
    return (
      <Coquille>
        <EtatMessage icone={<FileWarning className="size-10 text-muted-foreground" />} titre="Lien invalide" message="Ce lien de signature n'existe pas ou n'est plus valable. Contactez votre artisan pour en recevoir un nouveau." />
      </Coquille>
    );
  }
  const it = pub.fiche.intervention;
  const numero = it.fiche_numero ? ` n° ${it.fiche_numero}` : "";
  if (pub.etat === "expire") {
    return (
      <Coquille>
        <EtatMessage icone={<Clock className="size-10 text-muted-foreground" />} titre="Ce lien a expiré" message={`Le lien de signature de la fiche${numero} n'est plus valable. Contactez ${pub.prestataireNom} pour en recevoir un nouveau.`} />
      </Coquille>
    );
  }
  const pdf = (doc: "cerfa" | "bon") => `/api/public/fiches/${encodeURIComponent(token)}/pdf?doc=${doc}`;
  if (pub.etat === "signe") {
    return (
      <Coquille>
        <EtatMessage
          icone={<CheckCircle2 className="size-10 text-primary" />}
          titre={`Fiche${numero} signée`}
          message={`Merci${pub.detenteur ? ` ${pub.detenteur.nom}` : ""}. Votre signature du ${formatDateFr(pub.detenteur?.signe_le.slice(0, 10) ?? "")} est enregistrée (${pub.reservesText.toLowerCase()}) ; vos exemplaires signés vous ont été envoyés par e-mail.`}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline">
            <a href={pdf("cerfa")} target="_blank" rel="noopener">
              <FileCheck2 className="size-4" />
              Fiche CERFA 15497 signée
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={pdf("bon")} target="_blank" rel="noopener">
              <ClipboardCheck className="size-4" />
              Bon de réception signé
            </a>
          </Button>
        </div>
      </Coquille>
    );
  }

  const natures = it.natures_cerfa.filter((n): n is NatureIntervention => n in NATURES_INTERVENTION).map((n) => NATURES_COURTES[n]);
  const totaux = totauxManipulations(manipulationsDepuisJson(it.fluide_manipulations));
  const charge = it.fluide_charge_totale_kg !== null ? Number(it.fluide_charge_totale_kg) : null;
  const teq = equivalentCo2Tonnes(it.fluide_frigo_type, charge);
  const typeEquipement = it.equipement_type && it.equipement_type in TYPES_EQUIPEMENT ? TYPES_EQUIPEMENT[it.equipement_type as TypeEquipement] : null;
  const lignes: Array<[string, string]> = [
    ["Intervention", `le ${formatDateFr(it.date_intervention)}${natures.length ? ` · ${natures.join(", ")}` : ""}`],
    ["Équipement", [typeEquipement, it.equipement_marque, it.equipement_modele].filter(Boolean).join(" ") || "—"],
  ];
  if (it.equipement_repere) lignes.push(["Repère", it.equipement_repere]);
  if (it.equipement_num_serie) lignes.push(["N° de série", it.equipement_num_serie]);
  if (it.fluide_frigo_type) lignes.push(["Fluide", `${it.fluide_frigo_type}${charge !== null ? ` · ${charge.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} kg` : ""}${teq !== null ? ` · ${formatEquivalentCo2(teq)}` : ""}`]);
  if (totaux.ajoute > 0 || totaux.recupere > 0) lignes.push(["Fluide manipulé", `+${totaux.ajoute.toLocaleString("fr-FR")} kg ajouté · −${totaux.recupere.toLocaleString("fr-FR")} kg récupéré`]);
  if (it.etancheite_controle) lignes.push(["Contrôle d'étanchéité", it.etancheite_fuite ? `Fuite détectée${it.etancheite_fuite_localisation ? ` (${it.etancheite_fuite_localisation})` : ""}` : "Réalisé — aucune fuite"]);
  if (it.bon_objet) lignes.push(["Objet des travaux", it.bon_objet]);
  if (it.bon_devis_numero) lignes.push(["Devis", `n° ${it.bon_devis_numero}`]);

  return (
    <Coquille>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">{pub.prestataireNom}</p>
          <h1 className="text-xl font-bold tracking-tight">Fiche d&apos;intervention{numero}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fluides frigorigènes (CERFA 15497) et bon de réception des travaux
            {pub.fiche.client?.nom ? ` · pour ${pub.fiche.client.nom}` : ""}
          </p>
        </div>

        <dl className="divide-y rounded-lg border text-sm">
          {lignes.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {it.fluide_observations && (
          <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Observations : </span>
            {it.fluide_observations}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline">
            <a href={pdf("cerfa")} target="_blank" rel="noopener">
              <FileCheck2 className="size-4" />
              Lire la fiche CERFA (PDF)
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={pdf("bon")} target="_blank" rel="noopener">
              <ClipboardCheck className="size-4" />
              Lire le bon de réception (PDF)
            </a>
          </Button>
        </div>

        <SignatureFichePubliqueForm token={token} clientNom={pub.fiche.client?.nom ?? null} reservesInitiales={it.bon_reserves === "avec" ? it.bon_reserves_texte ?? "" : ""} />
      </div>
    </Coquille>
  );
}

function Coquille({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-muted/40 px-4 py-8 sm:items-center">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-center gap-2">
          <LogoMarque taille={28} />
        </div>
        <div className="space-y-4 rounded-2xl border bg-background p-5 shadow-sm sm:p-6">{children}</div>
      </div>
    </main>
  );
}

function EtatMessage({ icone, titre, message }: { icone: React.ReactNode; titre: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      {icone}
      <h1 className="text-lg font-semibold">{titre}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
