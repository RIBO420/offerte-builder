"use client";

import Link from "next/link";

interface VlootBadgeProps {
  hasIssues: boolean;
  issueCount: number;
  summary: string; // "alles operationeel" or "2 blokkades, 1 voorraad alert"
}

export function VlootBadge({ hasIssues, issueCount: _issueCount, summary }: VlootBadgeProps) {
  return (
    <div className="bg-[#141414] border border-white/[0.06] rounded-[10px] px-4 py-2.5 flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          hasIssues ? "bg-red-500" : "bg-green-500"
        }`}
        aria-hidden="true"
      />
      <span className="text-xs text-muted-foreground">
        Vloot &amp; Materieel — {summary}
      </span>
      <Link
        href="/wagenpark"
        className="text-[11px] text-muted-foreground/50 ml-auto hover:text-muted-foreground transition-colors"
      >
        {hasIssues ? "Bekijk →" : "Details →"}
      </Link>
    </div>
  );
}
