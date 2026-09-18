"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FileSignature,
  FileText,
  MoreHorizontal,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/mobile-nav";

/**
 * Barre d'onglets du bas (téléphone, < md) : les quatre écrans utilisés
 * sur le terrain à un tap du pouce, et « Plus » qui ouvre le menu
 * complet. Sur PC (≥ md) la barre latérale reste la navigation.
 *
 * Placée dans le flux du layout (pas en position fixe) : le contenu ne
 * passe jamais dessous et la zone sous la barre iPhone est respectée.
 */
export const ONGLETS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/devis", label: "Devis", icon: FileSignature },
  { href: "/factures", label: "Factures", icon: FileText },
  { href: "/contrats", label: "Contrats", icon: ScrollText },
];

export function BarreOnglets({ badgeTaches = 0 }: { badgeTaches?: number }) {
  const pathname = usePathname();
  const actif = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const plusActif = !ONGLETS.some((o) => actif(o.href));

  return (
    <nav
      aria-label="Navigation principale"
      className="grid shrink-0 grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {ONGLETS.map(({ href, label, icon: Icon }) => {
        const estActif = actif(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={estActif ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-[color,transform] active:scale-90",
              estActif ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("size-6", estActif && "fill-primary/15")} strokeWidth={estActif ? 2.25 : 1.75} />
            {label}
          </Link>
        );
      })}
      <MobileNav
        badgeTaches={badgeTaches}
        masquer={ONGLETS.map((o) => o.href)}
        trigger={
          <button
            type="button"
            aria-label="Plus de pages"
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-[color,transform] active:scale-90",
              plusActif ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="size-6" strokeWidth={plusActif ? 2.25 : 1.75} />
            Plus
            {badgeTaches > 0 && (
              <span className="absolute right-[calc(50%-1.25rem)] top-2 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
                {badgeTaches}
              </span>
            )}
          </button>
        }
      />
    </nav>
  );
}
