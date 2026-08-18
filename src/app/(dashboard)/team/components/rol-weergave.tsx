"use client";

import type { ElementType } from "react";
import {
  Crown,
  ClipboardList,
  HardHat,
  Wrench,
  UserRound,
  Handshake,
  Package,
  ShieldCheck,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/hooks/use-users";

/**
 * Eén tabel voor hoe een app-rol eruitziet — label, kleur en icoon.
 *
 * Stond eerder alleen in het gebruikersscherm; het Team-scherm toont dezelfde
 * rol op drie plekken (teamtabel, accountstabel, uitnodigen-dialoog), dus de
 * tabel woont hier en niet drie keer.
 *
 * `admin` en `viewer` staan er alleen in om bestaande databaserijen leesbaar
 * te houden. Nieuwe rollen deel je niet meer zo uit — zie
 * `UITNODIGBARE_ROLLEN` in `use-team.ts`.
 */
export const ROL_WEERGAVE: Record<
  UserRole,
  { label: string; badgeClass: string; icoon: ElementType }
> = {
  directie: {
    label: "Directie",
    badgeClass:
      "bg-status-afgewezen text-status-afgewezen-text border-status-afgewezen-border",
    icoon: Crown,
  },
  projectleider: {
    label: "Projectleider",
    badgeClass:
      "bg-status-gepland text-status-gepland-text border-status-gepland-border",
    icoon: ClipboardList,
  },
  voorman: {
    label: "Voorman",
    badgeClass:
      "bg-status-in-uitvoering text-status-in-uitvoering-text border-status-in-uitvoering-border",
    icoon: HardHat,
  },
  medewerker: {
    label: "Medewerker (veld)",
    badgeClass:
      "bg-status-geaccepteerd text-status-geaccepteerd-text border-status-geaccepteerd-border",
    icoon: Wrench,
  },
  klant: {
    label: "Klant",
    badgeClass:
      "bg-status-nacalculatie text-status-nacalculatie-text border-status-nacalculatie-border",
    icoon: UserRound,
  },
  onderaannemer_zzp: {
    label: "Onderaannemer / ZZP",
    badgeClass:
      "bg-status-verzonden text-status-verzonden-text border-status-verzonden-border",
    icoon: Handshake,
  },
  materiaalman: {
    label: "Materiaalman",
    badgeClass:
      "bg-status-definitief text-status-definitief-text border-status-definitief-border",
    icoon: Package,
  },
  admin: {
    label: "Admin (oud)",
    badgeClass:
      "bg-status-afgewezen text-status-afgewezen-text border-status-afgewezen-border",
    icoon: ShieldCheck,
  },
  viewer: {
    label: "Viewer (oud)",
    badgeClass:
      "bg-status-concept text-status-concept-text border-status-concept-border",
    icoon: Eye,
  },
};

export function rolLabel(rol: string): string {
  return ROL_WEERGAVE[rol as UserRole]?.label ?? rol;
}

/** De rolbadge zoals hij in beide tabellen staat. */
export function RolBadge({
  rol,
  className,
}: {
  rol: UserRole;
  className?: string;
}) {
  const weergave = ROL_WEERGAVE[rol] ?? ROL_WEERGAVE.medewerker;
  const Icoon = weergave.icoon;

  return (
    <Badge
      variant="outline"
      className={cn("max-w-full gap-1", weergave.badgeClass, className)}
      title={weergave.label}
    >
      <Icoon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{weergave.label}</span>
    </Badge>
  );
}
