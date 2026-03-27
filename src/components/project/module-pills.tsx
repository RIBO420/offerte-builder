"use client";

import Link from "next/link";
import {
  ListTodo,
  Clock,
  Euro,
  Calculator,
  FileText,
  MapPin,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/components/project/thin-progress-bar";

interface ModulePillsProps {
  projectId: string;
  projectStatus: ProjectStatus;
  offerteId: string | null;
  offerteNummer: string | null;
  hasWerklocatie: boolean;
  werklocatieLabel: string;
  planningTaken: { total: number; done: number };
  geregistreerdeUren: number;
  normUrenTotaal: number | null;
  nacalculatieAfwijking: number | null;
  onWerklocatieClick: () => void;
}

interface PillConfig {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  href?: string;
  onClick?: () => void;
  highlighted: boolean;
  variant?: "green";
}

export function ModulePills({
  projectId,
  projectStatus,
  offerteId,
  offerteNummer,
  werklocatieLabel,
  planningTaken,
  geregistreerdeUren,
  normUrenTotaal,
  nacalculatieAfwijking,
  onWerklocatieClick,
}: ModulePillsProps) {
  const effectiveStatus = projectStatus === "voorcalculatie" ? "gepland" : projectStatus;

  const pills: PillConfig[] = [
    {
      key: "planning",
      icon: ListTodo,
      label: "Planning",
      detail: `${planningTaken.done}/${planningTaken.total} taken`,
      href: `/projecten/${projectId}/planning`,
      highlighted: effectiveStatus === "gepland",
    },
    {
      key: "uitvoering",
      icon: Clock,
      label: "Uitvoering",
      detail: `${geregistreerdeUren.toFixed(1)} / ${normUrenTotaal?.toFixed(1) ?? "—"} uur`,
      href: `/projecten/${projectId}/uitvoering`,
      highlighted: effectiveStatus === "in_uitvoering",
    },
    {
      key: "kosten",
      icon: Euro,
      label: "Kosten",
      detail: "Live tracking",
      href: `/projecten/${projectId}/kosten`,
      highlighted: false,
    },
    {
      key: "nacalculatie",
      icon: Calculator,
      label: "Nacalculatie",
      detail: nacalculatieAfwijking !== null
        ? `${nacalculatieAfwijking > 0 ? "+" : ""}${nacalculatieAfwijking.toFixed(1)}% afwijking`
        : "Niet beschikbaar",
      href: `/projecten/${projectId}/nacalculatie`,
      highlighted: effectiveStatus === "afgerond" || effectiveStatus === "nacalculatie_compleet",
    },
  ];

  // Add factuur pill when nacalculatie is complete
  if (effectiveStatus === "nacalculatie_compleet" || effectiveStatus === "gefactureerd") {
    pills.push({
      key: "factuur",
      icon: Receipt,
      label: "Factuur",
      detail: effectiveStatus === "gefactureerd" ? "Verzonden" : "Gereed voor factuur",
      href: `/projecten/${projectId}/factuur`,
      highlighted: effectiveStatus === "nacalculatie_compleet",
      variant: "green",
    });
  }

  // Always add offerte and werklocatie
  if (offerteId) {
    pills.push({
      key: "offerte",
      icon: FileText,
      label: "Offerte",
      detail: offerteNummer ?? "Bekijk offerte",
      href: `/offertes/${offerteId}`,
      highlighted: false,
    });
  }

  pills.push({
    key: "werklocatie",
    icon: MapPin,
    label: "Werklocatie",
    detail: werklocatieLabel,
    onClick: onWerklocatieClick,
    highlighted: false,
  });

  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-2.5">
        Modules
      </p>
      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => {
          const Icon = pill.icon;
          const isGreen = pill.variant === "green";

          const content = (
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 transition-colors",
                pill.highlighted && !isGreen && "border-primary bg-primary/5",
                pill.highlighted && isGreen && "border-green-500 bg-green-500/5",
                !pill.highlighted && "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  pill.highlighted && !isGreen && "text-primary",
                  pill.highlighted && isGreen && "text-green-500",
                  !pill.highlighted && "text-muted-foreground"
                )}
              />
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-sm font-medium leading-tight",
                    pill.highlighted && !isGreen && "text-primary",
                    pill.highlighted && isGreen && "text-green-500",
                    !pill.highlighted && "text-foreground"
                  )}
                >
                  {pill.label}
                </div>
                <div
                  className={cn(
                    "text-[11px] leading-tight",
                    pill.highlighted && !isGreen && "text-primary/70",
                    pill.highlighted && isGreen && "text-green-500/70",
                    !pill.highlighted && "text-muted-foreground"
                  )}
                >
                  {pill.detail}
                </div>
              </div>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  pill.highlighted && !isGreen && "text-primary/50",
                  pill.highlighted && isGreen && "text-green-500/50",
                  !pill.highlighted && "text-muted-foreground/50"
                )}
              />
            </div>
          );

          if (pill.href) {
            return (
              <Link key={pill.key} href={pill.href}>
                {content}
              </Link>
            );
          }

          return (
            <button key={pill.key} onClick={pill.onClick} type="button">
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
