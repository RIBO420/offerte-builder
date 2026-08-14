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

// Alleen prioriteit "hoog" krijgt kleur (amber, via de status-tokenreceptuur);
// middel en laag blijven neutraal. Voorheen baadde het hele blok in amber en
// was "hoog" niet van "laag" te onderscheiden.
const PRIORITY_BADGE: Record<string, string> = {
  hoog: "bg-status-in-uitvoering text-status-in-uitvoering-text",
  middel: "bg-muted text-muted-foreground",
  laag: "bg-muted text-muted-foreground",
};

export function AandachtNodig({
  acceptedWithoutProject,
  warnings,
}: AandachtNodigProps) {
  const totalCount = acceptedWithoutProject.length + warnings.length;

  if (totalCount === 0) return null;

  return (
    // Neutrale kaart met één warme accentrand: het blok vraagt aandacht,
    // maar hoeft niet zelf het luidste vlak van de pagina te zijn.
    <div className="bg-card border border-border border-l-[3px] border-l-accent-warm rounded-xl p-3.5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5">
        <AlertTriangle className="h-4 w-4 text-accent-warm shrink-0" aria-hidden="true" />
        <span className="font-semibold text-sm">Aandacht nodig</span>
        <span className="bg-accent-warm/15 text-foreground text-[11px] font-semibold px-2 py-0.5 rounded-md tabular-nums">
          {totalCount}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {/* Accepted offertes without a project */}
        {acceptedWithoutProject.map((offerte) => (
          <div
            key={offerte._id}
            className="bg-muted/40 rounded-lg px-3 py-2 flex items-center justify-between gap-3"
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
              className="shrink-0 text-[11px] font-semibold px-3 py-1 rounded-lg h-auto min-h-6"
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
            className="bg-muted/40 rounded-lg px-3 py-2"
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
                  className="inline-flex min-h-6 items-center text-xs font-medium text-primary hover:underline shrink-0"
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
