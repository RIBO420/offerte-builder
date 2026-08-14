"use client";

import Link from "next/link";

interface VlootBadgeProps {
  hasIssues: boolean;
  issueCount: number;
  summary: string; // "alles operationeel" or "2 blokkades, 1 voorraad alert"
}

export function VlootBadge({ hasIssues, issueCount: _issueCount, summary }: VlootBadgeProps) {
  return (
    <div className="bg-card border border-border rounded-[10px] px-4 py-2.5 flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          hasIssues ? "bg-destructive" : "bg-status-geaccepteerd-dot"
        }`}
        aria-hidden="true"
      />
      <span className="text-xs text-muted-foreground">
        Vloot &amp; Materieel — {summary}
      </span>
      {/* Leesbaar (geen /50-opacity) en klikvlak ≥ 24px (WS3b) */}
      <Link
        href="/wagenpark"
        className="inline-flex min-h-6 items-center text-[11px] font-medium text-muted-foreground ml-auto hover:text-foreground transition-colors"
      >
        {hasIssues ? "Bekijk →" : "Details →"}
      </Link>
    </div>
  );
}
