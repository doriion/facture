"use client";

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
    <header className="flex h-16 items-center justify-end border-b bg-background px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <User className="size-4" />
            <span className="max-w-[200px] truncate">{email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
            <LogOut className="size-4" />
            <span>Se déconnecter</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
