/**
 * Constantes partagées (libellés, configuration UI).
 */

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ListTodo,
  FileText,
  FileSignature,
  Users,
  Package,
  Wrench,
  CalendarClock,
  CalendarDays,
  FileSpreadsheet,
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
    href: "/taches",
    label: "À faire",
    icon: ListTodo,
    description: "Pense-bête : notes, photos, rappels",
  },
  {
    href: "/agenda",
    label: "Agenda",
    icon: CalendarDays,
    description: "Vue calendrier des interventions et facturation",
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
    href: "/exports",
    label: "Export URSSAF",
    icon: FileSpreadsheet,
    description: "CSV trimestriel pour déclaration",
  },
  {
    href: "/parametres",
    label: "Paramètres",
    icon: Settings,
  },
];

// Les seuils micro-entreprise (franchise TVA, plafond micro) sont
// désormais centralisés dans lib/seuils-micro.ts — à vérifier chaque
// année en loi de finances.
