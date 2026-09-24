"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";

import { signOutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BoutonRetour } from "@/components/bouton-retour";
import { LogoMarque } from "@/components/logo-marque";
import { RechercheGlobale } from "@/components/recherche-globale";
import { ThemeToggle } from "@/components/theme-toggle";
import { NOM_APPLICATION } from "@/lib/marque";

/**
 * Bandeau supérieur. Affiche l'email connecté + menu déconnexion.
 * La déconnexion passe par une Server Action pour cohérence avec le
 * login (cookies serveur + redirect synchrones).
 */
export function Topbar({ email }: { email: string }) {
  async function handleSignOut() {
    try {
      await signOutAction();
      // signOutAction redirige côté serveur ; ce code n'est pas atteint
      // sauf en cas d'erreur réseau.
    } catch (err) {
      toast.error("Erreur lors de la déconnexion", {
        description: err instanceof Error ? err.message : "Inconnue",
      });
    }
  }

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-background px-3 sm:h-16 sm:px-6">
      <div className="flex items-center gap-2">
        {/* Téléphone : « Retour » sur les sous-pages ; le menu est dans
            la barre d'onglets du bas. */}
        <BoutonRetour />
        <Link href="/dashboard" className="flex items-center gap-2 md:hidden">
          <LogoMarque taille={28} />
          <span className="text-sm font-semibold">{NOM_APPLICATION}</span>
        </Link>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
      <RechercheGlobale />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="size-4" />
            <span className="hidden max-w-[200px] truncate sm:inline">
              {email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ThemeToggle />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
            <LogOut className="size-4" />
            <span>Se déconnecter</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
