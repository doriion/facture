"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { LogoMarque } from "@/components/logo-marque";
import { NOM_APPLICATION } from "@/lib/marque";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Bouton hamburger + drawer latéral qui réplique la navigation de la
 * sidebar sur les écrans < md. La sidebar standard reste affichée
 * en >=md, donc ce composant est masqué à ces tailles.
 */
export function MobileNav({
  badgeTaches = 0,
  trigger,
  masquer = [],
}: {
  badgeTaches?: number;
  /** Déclencheur à la place du bouton hamburger (onglet « Plus » de la barre du bas). */
  trigger?: React.ReactNode;
  /** Écrans déjà présents dans la barre du bas : inutile de les répéter. */
  masquer?: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const estActif = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Depuis l'onglet « Plus » : feuille qui monte du bas, tuiles en
  // grille sous le pouce — au lieu d'un tiroir latéral avec une liste
  // qui commence en haut de l'écran, hors de portée à une main.
  if (trigger) {
    const items = NAV_ITEMS.filter((item) => !masquer.includes(item.href));
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="mb-3 text-base">Plus</SheetTitle>
          <Button asChild className="mb-3 w-full" size="lg">
            <Link href="/taches?ajouter=1" onClick={() => setOpen(false)}>
              <Plus className="size-4" />
              Nouvelle tâche
            </Link>
          </Button>
          <nav className="grid grid-cols-3 gap-2" aria-label="Autres écrans">
            {items.map((item) => {
              const Icon = item.icon;
              const actif = estActif(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "relative flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center text-xs font-medium transition-colors active:scale-95",
                    actif
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-foreground/90 hover:bg-accent",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="leading-tight">{item.label}</span>
                  {item.href === "/taches" && badgeTaches > 0 && (
                    <span className="absolute right-2 top-2 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive-foreground">
                      {badgeTaches}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ouvrir le menu"
            className="relative md:hidden"
          >
            <Menu className="size-5" />
            {badgeTaches > 0 && (
              <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
                {badgeTaches}
              </span>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="left">
        <div className="flex h-16 items-center border-b px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <LogoMarque taille={32} />
            <SheetTitle>{NOM_APPLICATION}</SheetTitle>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {/* Pense-bête depuis n'importe quel écran : deux taps
              (« Plus » puis ce bouton) et la saisie éclair s'ouvre. */}
          <Button asChild className="mb-2 w-full justify-start" size="lg">
            <Link href="/taches?ajouter=1" onClick={() => setOpen(false)}>
              <Plus className="size-4" />
              Nouvelle tâche
            </Link>
          </Button>
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.href === "/taches" && badgeTaches > 0 && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                      isActive
                        ? "bg-primary-foreground/20"
                        : "bg-destructive text-destructive-foreground",
                    )}
                  >
                    {badgeTaches}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">
          <p>Auto-entrepreneur BTP</p>
          <p className="mt-0.5">Franchise TVA — art. L.223-3 CIBS</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
