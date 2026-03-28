"use client";

import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Layers, Info } from "lucide-react";
import { type FunderingsSpec, LAAG_TOOLTIPS, LAAG_KLEUREN } from "./bestrating-constants";

// ─── Funderingsvisualisatie component ────────────────────────────────────────

interface FunderingsVisualisatieProps {
  spec: FunderingsSpec;
}

export function FunderingsVisualisatie({ spec }: FunderingsVisualisatieProps) {
  const lagen: Array<{ key: string; label: string; dikte: number | string }> = [];

  if (spec.stabiliser) {
    lagen.push({ key: "stabiliser", label: "Stabiliser (cement)", dikte: "gemengd" });
  }
  if (spec.brekerszand && spec.brekerszand > 0) {
    lagen.push({ key: "brekerszand", label: "Brekerszand", dikte: spec.brekerszand });
  }
  if (spec.zand > 0) {
    lagen.push({ key: "zand", label: "Straatzand", dikte: spec.zand });
  }
  lagen.push({ key: "gebrokenPuin", label: "Gebroken puin", dikte: spec.gebrokenPuin });

  // Calculate total height for proportional display
  const totalCm = lagen.reduce((sum, l) => {
    if (typeof l.dikte === "number") return sum + l.dikte;
    return sum + 3; // stabiliser gets a thin bar
  }, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Layers className="h-3.5 w-3.5" />
        Funderingsopbouw
      </div>
      <div className="rounded-lg border bg-muted/30 p-3">
        {/* Top: bestrating */}
        <div className="mb-1 flex items-center justify-between rounded-t-md border border-slate-400 bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200">
          <span>Bestrating</span>
        </div>

        {/* Foundation layers */}
        <div className="flex flex-col">
          {lagen.map((laag, index) => {
            const kleur = LAAG_KLEUREN[laag.key];
            const tooltip = LAAG_TOOLTIPS[laag.key];
            const isLast = index === lagen.length - 1;
            const minH =
              typeof laag.dikte === "number"
                ? Math.max(28, (laag.dikte / totalCm) * 120)
                : 24;

            return (
              <div
                key={laag.key}
                className={`flex items-center justify-between border-x border-b px-3 ${kleur.bg} ${kleur.border} ${kleur.text} ${isLast ? "rounded-b-md" : ""}`}
                style={{ minHeight: `${minH}px` }}
              >
                <span className="text-xs font-medium">{laag.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">
                    {typeof laag.dikte === "number" ? `${laag.dikte} cm` : laag.dikte}
                  </span>
                  {tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[220px]">
                        {tooltip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grond */}
        <div className="mt-1 flex items-center justify-center rounded-b-md border border-dashed border-amber-700/40 bg-amber-900/10 px-3 py-1 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-900/20 dark:text-amber-300">
          Ondergrond
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic">{spec.beschrijving}</p>
    </div>
  );
}
