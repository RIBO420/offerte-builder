"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Loading skeleton for MedewerkerDetailDialog
function MedewerkerDetailDialogSkeleton() {
  return (
    <div className="max-w-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-lg">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 uppercase" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 uppercase" />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="w-10 h-10 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dynamically imported MedewerkerDetailDialog
 * Heavy dialog with tabs, stats, and multiple sub-components
 */
export const DynamicMedewerkerDetailDialog = dynamic(
  () =>
    import("./medewerker-detail-dialog").then(
      (mod) => mod.MedewerkerDetailDialog
    ),
  {
    loading: () => <MedewerkerDetailDialogSkeleton />,
    ssr: false,
  }
);
