"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AandachtNodigProps {
  acceptedWithoutProject: Array<{
    _id: string;
    offerteNummer: string;
    klantNaam: string;
  }>;
  warnings: Array<{
    id: string;
    type: string;
    prioriteit: "hoog" | "middel" | "laag";
    titel: string;
    beschrijving: string;
    actie?: string;
    link?: string;
  }>;
}

const PRIORITY_BADGE: Record<string, string> = {
  hoog: "bg-red-500/15 text-red-400",
  middel: "bg-amber-500/15 text-amber-400",
  laag: "bg-blue-500/15 text-blue-400",
};

export function AandachtNodig({
  acceptedWithoutProject,
  warnings,
}: AandachtNodigProps) {
  const totalCount = acceptedWithoutProject.length + warnings.length;

  if (totalCount === 0) return null;

  return (
    <div className="bg-amber-500/5 border border-amber-500/12 border-l-[3px] border-l-amber-500 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="font-semibold text-amber-400 text-sm">
          Aandacht nodig
        </span>
        <span className="bg-amber-500/15 text-amber-400 text-[11px] font-semibold px-2 py-0.5 rounded-md">
          {totalCount}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {/* Accepted offertes without a project */}
        {acceptedWithoutProject.map((offerte) => (
          <div
            key={offerte._id}
            className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{offerte.klantNaam}</p>
              <p className="text-xs text-muted-foreground">
                {offerte.offerteNummer}
              </p>
            </div>
            <Button
              asChild
              size="sm"
              className="shrink-0 bg-amber-500 text-black text-[11px] font-bold px-3 py-1 rounded-lg h-auto"
            >
              <Link href={`/projecten/nieuw?offerte=${offerte._id}`}>
                Start Project
              </Link>
            </Button>
          </div>
        ))}

        {/* Warnings */}
        {warnings.map((warning) => (
          <div
            key={warning.id}
            className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-3.5 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{warning.titel}</p>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${PRIORITY_BADGE[warning.prioriteit] ?? PRIORITY_BADGE.laag}`}
                  >
                    {warning.prioriteit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {warning.beschrijving}
                </p>
              </div>
              {warning.link && (
                <Link
                  href={warning.link}
                  className="text-xs text-amber-400 hover:text-amber-300 shrink-0 mt-0.5"
                >
                  Bekijk →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
