"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
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
export function MobileNav({ badgeTaches = 0 }: { badgeTaches?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
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
      </SheetTrigger>
      <SheetContent side="left">
        <div className="flex h-16 items-center border-b px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-sm font-bold">F</span>
            </div>
            <SheetTitle>Facture AE</SheetTitle>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
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
