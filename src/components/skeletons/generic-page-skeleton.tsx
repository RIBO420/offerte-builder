import { Skeleton } from "@/components/ui/skeleton";
import { StatsGridSkeleton, CardTableSkeleton } from "@/components/ui/skeleton-card";

type PageVariant = "table" | "card-grid" | "form";

interface GenericPageSkeletonProps {
  /** Dutch label for screen readers */
  label: string;
  /** Page title width class (default: "w-40") */
  titleWidth?: string;
  /** Page subtitle width class (default: "w-64") */
  subtitleWidth?: string;
  /** Whether to show an action button in the header */
  showActionButton?: boolean;
  /** Action button width class (default: "w-36") */
  actionButtonWidth?: string;
  /** Whether to show a stats grid */
  showStats?: boolean;
  /** Number of stat cards (default: 4) */
  statsCount?: number;
  /** Stats grid columns (default: 4) */
  statsColumns?: 3 | 4 | 5;
  /** Main content variant */
  variant?: PageVariant;
  /** Number of table rows for table variant (default: 6) */
  tableRows?: number;
  /** Number of cards for card-grid variant (default: 6) */
  cardCount?: number;
  /** Number of form fields for form variant (default: 6) */
  formFields?: number;
  /** Whether to show a search bar */
  showSearch?: boolean;
}

export function GenericPageSkeleton({
  label,
  titleWidth = "w-40",
  subtitleWidth = "w-64",
  showActionButton = false,
  actionButtonWidth = "w-36",
  showStats = false,
  statsCount = 4,
  statsColumns = 4,
  variant = "table",
  tableRows = 6,
  cardCount = 6,
  formFields = 6,
  showSearch = false,
}: GenericPageSkeletonProps) {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>

      {/* Page header skeleton */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Title + optional action button */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className={`h-8 ${titleWidth} mb-2`} />
            <Skeleton className={`h-4 ${subtitleWidth}`} />
          </div>
          {showActionButton && (
            <Skeleton className={`h-10 ${actionButtonWidth}`} />
          )}
        </div>

        {/* Optional stats grid */}
        {showStats && (
          <StatsGridSkeleton count={statsCount} columns={statsColumns} />
        )}

        {/* Optional search bar */}
        {showSearch && (
          <div className="relative w-full sm:max-w-sm">
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {/* Main content area */}
        {variant === "table" && <CardTableSkeleton rows={tableRows} />}

        {variant === "card-grid" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: cardCount }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {variant === "form" && (
          <div className="space-y-6 max-w-2xl">
            <div className="rounded-xl border bg-card p-6">
              <Skeleton className="h-6 w-40 mb-2" />
              <Skeleton className="h-4 w-64 mb-6" />
              <div className="space-y-4">
                {Array.from({ length: formFields }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-10 w-32 mt-6" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
