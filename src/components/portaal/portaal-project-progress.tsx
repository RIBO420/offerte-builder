"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Clock,
  Circle,
  Loader2,
} from "lucide-react";

// Map of scope keys to human-readable Dutch labels
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",
};

// Project status order for progress determination
const statusOrder = [
  "concept",
  "voorcalculatie",
  "in_uitvoering",
  "opgeleverd",
  "afgerond",
] as const;

type ProjectStatus = (typeof statusOrder)[number] | string;

function getStatusLabel(status: ProjectStatus): string {
  const labels: Record<string, string> = {
    concept: "Concept",
    voorcalculatie: "Voorcalculatie",
    in_uitvoering: "In uitvoering",
    opgeleverd: "Opgeleverd",
    afgerond: "Afgerond",
  };
  return labels[status] ?? status;
}

function getStatusColor(status: ProjectStatus): {
  bg: string;
  text: string;
  icon: typeof CheckCircle;
} {
  switch (status) {
    case "afgerond":
    case "opgeleverd":
      return { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", icon: CheckCircle };
    case "in_uitvoering":
      return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: Loader2 };
    case "voorcalculatie":
      return { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", icon: Clock };
    default:
      return { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", icon: Circle };
  }
}

interface PortaalProjectProgressProps {
  status: ProjectStatus;
  scopes?: string[];
  className?: string;
}

export function PortaalProjectProgress({
  status,
  scopes,
  className,
}: PortaalProjectProgressProps) {
  const currentIndex = statusOrder.indexOf(status as (typeof statusOrder)[number]);
  const totalSteps = statusOrder.length;
  const progressPercent = currentIndex >= 0
    ? Math.round(((currentIndex + 1) / totalSteps) * 100)
    : 0;

  const statusConfig = getStatusColor(status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Status indicator */}
      <div className="flex items-center gap-3">
        <div className={cn("rounded-full p-2", statusConfig.bg)}>
          <StatusIcon className={cn(
            "h-5 w-5",
            statusConfig.text,
            status === "in_uitvoering" && "animate-spin"
          )} />
        </div>
        <div>
          <p className={cn("font-semibold text-sm", statusConfig.text)}>
            {getStatusLabel(status)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {progressPercent}% voltooid
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#4ADE80] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {/* Status step indicators */}
        <div className="flex justify-between mt-2">
          {statusOrder.map((step, index) => {
            const isPast = currentIndex >= 0 && index < currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <div key={step} className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-3 h-3 rounded-full border-2 -mt-[18px] bg-white dark:bg-[#0a0f0a]",
                    isPast && "border-[#4ADE80] bg-[#4ADE80] dark:bg-[#4ADE80]",
                    isCurrent && "border-[#4ADE80]",
                    !isPast && !isCurrent && "border-gray-300 dark:border-gray-600"
                  )}
                />
                <span className={cn(
                  "text-[10px] mt-1 hidden sm:block",
                  isCurrent
                    ? "text-gray-900 dark:text-white font-medium"
                    : "text-gray-400 dark:text-gray-500"
                )}>
                  {getStatusLabel(step)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scope tags */}
      {scopes && scopes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {scopes.map((scope) => (
            <span
              key={scope}
              className="inline-flex items-center rounded-md bg-[#4ADE80]/10 px-2 py-0.5 text-xs font-medium text-[#2a7a2a] dark:text-[#4ADE80]"
            >
              {scopeLabels[scope] ?? scope}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
