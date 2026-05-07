/**
 * Constantes partagées (libellés, configuration UI).
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FileText,
  FileSignature,
  Users,
  Package,
  Wrench,
  CalendarClock,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
};

/**
 * Navigation latérale principale (sidebar).
 * Ordre = ordre d'affichage.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
  },
  {
    href: "/factures",
    label: "Factures",
    icon: FileText,
  },
  {
    href: "/devis",
    label: "Devis",
    icon: FileSignature,
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
  },
  {
    href: "/produits",
    label: "Catalogue",
    icon: Package,
    description: "Prestations et tarifs",
  },
  {
    href: "/interventions",
    label: "Interventions",
    icon: Wrench,
    description: "Suivi chantiers + fluides frigo",
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: CalendarClock,
    description: "Contrats récurrents",
  },
  {
    href: "/parametres",
    label: "Paramètres",
    icon: Settings,
  },
];

/**
 * Seuils de franchise TVA en auto-entrepreneur (régime micro).
 * Source : article 293 B du CGI.
 */
export const SEUILS_FRANCHISE_TVA = {
  services: 37500,
  ventes: 91900,
} as const;

/**
 * Mention légale obligatoire sur les factures d'un auto-entrepreneur
 * en franchise de TVA.
 */
export const MENTION_TVA_AE = "TVA non applicable, art. 293 B du CGI";
