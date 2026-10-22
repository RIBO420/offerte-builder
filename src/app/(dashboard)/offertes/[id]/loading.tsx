import { Skeleton } from "@/components/ui/skeleton";
import { OfferteDetailSkeleton } from "@/components/skeletons";

export default function OfferteDetailLoading() {
  return (
    <div aria-live="polite">
      <span className="sr-only">Offerte laden...</span>

      {/* Page header breadcrumb */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Zelfde opbouw en container als de geladen pagina (variant A) */}
      <div className="@container/offerte flex flex-1 flex-col p-4 md:px-8 md:py-6">
        <OfferteDetailSkeleton />
      </div>
    </div>
  );
}
