import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { aujourdhuiParis } from "@/lib/dates";
import { SaisieTournee } from "@/components/tournee/saisie-tournee";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Saisir une tournée — NG Gestion" };

/**
 * Une tournée entière en une fois : coller la liste du donneur d'ordre
 * (SMS, mail, tableau) ou photographier le planning papier ; l'app
 * découpe dates, heures, noms, adresses et téléphones, vous vérifiez,
 * puis clients et rendez-vous sont créés d'un coup.
 */
export default function TourneePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 max-md:hidden">
          <Link href="/agenda">
            <ArrowLeft className="size-4" />
            Retour à l&apos;agenda
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Saisir une tournée</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Collez la liste reçue (une date en titre, puis un rendez-vous par ligne ou par bloc : nom, adresse, téléphone, heure) ou photographiez le planning. Vous vérifiez, puis tout se crée d&apos;un coup : clients et rendez-vous.
        </p>
      </div>
      <SaisieTournee dateParDefaut={aujourdhuiParis()} />
    </div>
  );
}
