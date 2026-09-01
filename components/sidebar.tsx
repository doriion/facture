"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";

/**
 * Sidebar de navigation principale. Met en surbrillance la route active.
 * `badgeTaches` : nombre de tâches du jour/en retard, affiché sur
 * l'entrée « À faire ».
 */
export function Sidebar({ badgeTaches = 0 }: { badgeTaches?: number }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-bold">F</span>
          </div>
          <span className="text-base font-semibold">Facture AE</span>
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
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
    </aside>
  );
}
