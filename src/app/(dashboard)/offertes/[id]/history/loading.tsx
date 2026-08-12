import { Skeleton } from "@/components/ui/skeleton";
import { OfferteHistorySkeleton } from "@/components/skeletons";

/**
 * Zonder dit bestand toonde Next.js hier offertes/[id]/loading.tsx: de
 * skeleton van de offertedetailpagina (twee kolommen, klantgegevens, regels).
 * De versiegeschiedenis is een tijdlijn in één kolom — dus die fallback
 * sprong. Hergebruikt exact de skeleton uit page.tsx, inclusief de padding
 * van de container waarin die daar staat.
 */
export default function OfferteHistoryLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Offertes / <nummer> / Geschiedenis */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <OfferteHistorySkeleton />
      </div>
    </>
  );
}
