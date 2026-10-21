import { CalendarCheck, CalendarX2, Clock, FileWarning } from "lucide-react";

import { getPropositionParToken } from "@/lib/visites/public";
import { libelleCreneau } from "@/lib/creneaux-visite";
import { ChoixCreneauForm } from "@/components/visites/choix-creneau-form";
import { LogoMarque } from "@/components/logo-marque";

export const metadata = {
  title: "Votre visite d'entretien",
  // Page nominative accessible par lien : jamais indexée.
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

/**
 * Page PUBLIQUE de réponse à une proposition de visite (aucun compte) :
 * le client accède par le lien unique reçu par e-mail, confirme le
 * créneau proposé, en choisit un autre parmi les créneaux libres, ou
 * décline. Le jeton est résolu côté serveur (service role).
 */
export default async function VisitePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const pub = await getPropositionParToken(token);

  if (pub.etat === "indisponible") {
    return (
      <Coquille>
        <EtatMessage
          icone={<FileWarning className="size-10 text-muted-foreground" />}
          titre="Service momentanément indisponible"
          message="Impossible d'afficher la proposition pour le moment. Réessayez dans quelques minutes, ou contactez votre artisan. Votre lien reste valable."
        />
      </Coquille>
    );
  }
  if (pub.etat === "introuvable" || pub.etat === "annulee" || !pub.proposition || !pub.propose) {
    return (
      <Coquille>
        <EtatMessage
          icone={<FileWarning className="size-10 text-muted-foreground" />}
          titre="Lien invalide"
          message="Cette proposition n'existe pas ou n'est plus valable. Contactez votre artisan pour convenir d'une date."
        />
      </Coquille>
    );
  }
  if (pub.etat === "expiree") {
    return (
      <Coquille>
        <EtatMessage
          icone={<Clock className="size-10 text-muted-foreground" />}
          titre="Ce lien a expiré"
          message={`La date proposée est passée ou le lien n'est plus valable. Contactez ${pub.prestataireNom} pour convenir d'une nouvelle date.`}
        />
      </Coquille>
    );
  }
  if (pub.etat === "repondue") {
    const refus = pub.proposition.statut === "refusee";
    return (
      <Coquille>
        <EtatMessage
          icone={refus ? <CalendarX2 className="size-10 text-muted-foreground" /> : <CalendarCheck className="size-10 text-primary" />}
          titre={refus ? "Réponse bien reçue" : "Rendez-vous confirmé"}
          message={
            refus
              ? `${pub.prestataireNom} a bien noté qu'aucun créneau ne vous convenait et vous recontacte pour convenir d'une date.`
              : `${pub.choix ? libelleCreneau(pub.choix) : "Votre créneau"} — le rendez-vous est dans l'agenda de ${pub.prestataireNom}. Un e-mail de confirmation vous a été envoyé.`
          }
        />
      </Coquille>
    );
  }

  return (
    <Coquille>
      <div className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">{pub.prestataireNom}</p>
          <h1 className="text-xl font-bold tracking-tight">Votre visite d&apos;entretien</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entretien de votre installation : <span className="font-medium text-foreground">{pub.objetEntretien}</span>.
            Choisissez le créneau qui vous convient ; il s&apos;inscrit directement dans l&apos;agenda.
          </p>
        </div>
        <ChoixCreneauForm
          token={token}
          creneauPropose={libelleCreneau(pub.propose)}
          autres={pub.autres.map((a) => ({ index: a.index, libelle: libelleCreneau(a.creneau) }))}
        />
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
        <div className="rounded-2xl border bg-background p-5 shadow-sm sm:p-6">{children}</div>
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
