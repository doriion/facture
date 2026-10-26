import { CheckCircle2, Clock, FileText, FileWarning } from "lucide-react";

import { getDevisParToken } from "@/lib/devis/public";
import { SignatureDevisPubliqueForm } from "@/components/devis/signature-devis-publique-form";
import { LogoMarque } from "@/components/logo-marque";
import { Button } from "@/components/ui/button";
import { formatDateFr, formatEuros, formatQuantite } from "@/lib/format";
import { mentionTvaFranchise } from "@/lib/legal-text";

export const metadata = {
  title: "Signature du devis",
  // Page nominative accessible par lien : jamais indexée.
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

/**
 * Page PUBLIQUE de signature d'un devis (aucun compte) : le client
 * accède par le lien unique reçu par e-mail, relit le devis (lignes et
 * total, PDF complet), indique son nom, coche « bon pour accord » et
 * signe au doigt. Le jeton est résolu côté serveur (service role).
 */
export default async function SignatureDevisPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const pub = await getDevisParToken(token);

  if (pub.etat === "indisponible") {
    return (
      <Coquille>
        <EtatMessage icone={<FileWarning className="size-10 text-muted-foreground" />} titre="Service momentanément indisponible" message="Impossible d'afficher le devis pour le moment. Réessayez dans quelques minutes, ou contactez votre artisan. Votre lien reste valable." />
      </Coquille>
    );
  }
  if (pub.etat === "introuvable" || pub.etat === "revoque" || !pub.devis) {
    return (
      <Coquille>
        <EtatMessage icone={<FileWarning className="size-10 text-muted-foreground" />} titre="Lien invalide" message="Ce lien de signature n'existe pas ou n'est plus valable. Contactez votre artisan pour recevoir un nouveau devis." />
      </Coquille>
    );
  }
  if (pub.etat === "expire") {
    return (
      <Coquille>
        <EtatMessage icone={<Clock className="size-10 text-muted-foreground" />} titre="Ce devis n'est plus valable" message={`La date de validité du devis ${pub.devis.numero} est dépassée. Contactez ${pub.prestataireNom} pour un devis à jour.`} />
      </Coquille>
    );
  }
  const d = pub.devis;
  if (pub.etat === "signe") {
    return (
      <Coquille>
        <EtatMessage
          icone={<CheckCircle2 className="size-10 text-primary" />}
          titre={`Devis ${d.numero} signé`}
          message={`Merci${d.signataire_nom ? ` ${d.signataire_nom}` : ""}. Votre bon pour accord du ${formatDateFr(d.date_signature ?? "")} est enregistré ; votre exemplaire signé vous a été envoyé par e-mail. ${pub.prestataireNom} revient vers vous pour la date d'intervention.`}
        />
        <div className="flex justify-center">
          <Button asChild variant="outline">
            <a href={`/api/public/devis/${encodeURIComponent(token)}/pdf`} target="_blank" rel="noopener">
              <FileText className="size-4" />
              Voir le devis signé (PDF)
            </a>
          </Button>
        </div>
      </Coquille>
    );
  }

  return (
    <Coquille>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">{pub.prestataireNom}</p>
          <h1 className="text-xl font-bold tracking-tight">Devis {d.numero}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Émis le {formatDateFr(d.date_emission)}
            {d.date_validite ? ` · valable jusqu'au ${formatDateFr(d.date_validite)}` : ""}
            {pub.client?.nom ? ` · pour ${pub.client.nom}` : ""}
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Désignation</th>
                <th className="px-2 py-2 text-right font-medium">Qté</th>
                <th className="px-3 py-2 text-right font-medium">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {pub.lignes.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">{l.designation}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatQuantite(l.quantite)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatEuros(Number(l.total_ht))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td className="px-3 py-2 font-semibold" colSpan={2}>
                  Total
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-base font-bold tabular-nums">{formatEuros(Number(d.total_ht))}</td>
              </tr>
            </tfoot>
          </table>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">{mentionTvaFranchise()}</p>
        </div>

        <Button asChild variant="outline" className="w-full">
          <a href={`/api/public/devis/${encodeURIComponent(token)}/pdf`} target="_blank" rel="noopener">
            <FileText className="size-4" />
            Lire le devis complet (PDF)
          </a>
        </Button>

        <SignatureDevisPubliqueForm token={token} numero={d.numero} clientNom={pub.client?.nom ?? null} acompteText={pub.acompteText} />
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
