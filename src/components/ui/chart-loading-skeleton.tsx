"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartLoadingSkeletonProps {
  height?: number;
  className?: string;
  type?: "bar" | "donut" | "line";
}

/**
 * Reusable loading skeleton for dynamically imported chart components
 */
export function ChartLoadingSkeleton({
  height = 300,
  className,
  type = "bar",
}: ChartLoadingSkeletonProps) {
  if (type === "donut") {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          className
        )}
        style={{ height }}
      >
        <Skeleton className="w-48 h-48 rounded-full" />
      </div>
    );
  }

  if (type === "line") {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 p-4",
          className
        )}
        style={{ height }}
      >
        <div className="flex-1 flex items-end gap-1">
          {[40, 65, 35, 80, 55, 70, 45, 90, 60, 75, 50, 85].map((h, i) => (
            <Skeleton
              key={i}
              className="flex-1"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  // Default bar chart skeleton
  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4",
        className
      )}
      style={{ height }}
    >
      <Skeleton className="h-4 w-24" />
      <div className="flex-1 flex items-end gap-2">
        {[60, 80, 40, 70, 55, 90, 65, 75].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

interface DialogLoadingSkeletonProps {
  className?: string;
}

/**
 * Loading skeleton for dynamically imported dialog components
 */
export function DialogLoadingSkeleton({ className }: DialogLoadingSkeletonProps) {
  return (
    <div className={cn("space-y-4 p-6", className)}>
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

/**
 * Loading skeleton for PDF preview components
 */
export function PDFLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full aspect-[1/1.414] bg-muted rounded-lg p-8 space-y-6",
        className
      )}
    >
      <div className="flex justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-6 w-24" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex justify-end">
        <Skeleton className="h-6 w-32" />
      </div>
    </div>
  );
}
