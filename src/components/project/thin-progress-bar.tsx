"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type ProjectStatus =
  | "voorcalculatie"
  | "gepland"
  | "in_uitvoering"
  | "afgerond"
  | "nacalculatie_compleet"
  | "gefactureerd";

const STATUS_ORDER: ProjectStatus[] = [
  "gepland",
  "in_uitvoering",
  "afgerond",
  "nacalculatie_compleet",
  "gefactureerd",
];

const STATUS_LABELS: Record<string, string> = {
  gepland: "Gepland",
  in_uitvoering: "In Uitvoering",
  afgerond: "Afgerond",
  nacalculatie_compleet: "Nacalculatie",
  gefactureerd: "Gefactureerd",
};

interface ThinProgressBarProps {
  projectId: string;
  projectStatus: ProjectStatus;
}

export function ThinProgressBar({ projectId, projectStatus }: ThinProgressBarProps) {
  const effectiveStatus = projectStatus === "voorcalculatie" ? "gepland" : projectStatus;
  const activeIndex = STATUS_ORDER.indexOf(effectiveStatus);

  const stepHrefs: (string | null)[] = [
    `/projecten/${projectId}/planning`,
    activeIndex >= 1 ? `/projecten/${projectId}/uitvoering` : null,
    `/projecten/${projectId}`,
    activeIndex >= 2 ? `/projecten/${projectId}/nacalculatie` : null,
    activeIndex >= 3 ? `/projecten/${projectId}/factuur` : null,
  ];

  return (
    <nav aria-label="Project voortgang" className="w-full">
      {/* Segmented bar */}
      <div className="flex gap-1 mb-2">
        {STATUS_ORDER.map((status, i) => (
          <div
            key={status}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= activeIndex ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        {STATUS_ORDER.map((status, i) => {
          const isActive = i === activeIndex;
          const isCompleted = i < activeIndex;
          const isFuture = i > activeIndex;
          const href = stepHrefs[i];
          const label = STATUS_LABELS[status];

          const labelClasses = cn(
            "text-[11px] font-medium transition-colors",
            isActive && "text-primary",
            isCompleted && "text-muted-foreground",
            isFuture && "text-muted-foreground/50"
          );

          if (href && !isFuture) {
            return (
              <Link
                key={status}
                href={href}
                className={cn(labelClasses, "hover:text-primary/80")}
              >
                {label}
              </Link>
            );
          }

          return (
            <span key={status} className={labelClasses}>
              {label}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
