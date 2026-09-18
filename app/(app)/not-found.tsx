import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Page introuvable dans l'application (lien périmé, document supprimé,
 * adresse mal tapée) : la coque reste, on propose les écrans utiles.
 */
export default function Introuvable() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <SearchX className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-bold tracking-tight">Page introuvable</h1>
      <p className="text-sm text-muted-foreground">
        Ce document n&apos;existe pas ou plus, ou le lien est périmé.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/agenda">Agenda</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/factures">Factures</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/devis">Devis</Link>
        </Button>
      </div>
    </div>
  );
}
