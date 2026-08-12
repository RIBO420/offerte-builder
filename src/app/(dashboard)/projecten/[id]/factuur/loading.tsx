import { Skeleton } from "@/components/ui/skeleton";
import { FactuurPageSkeleton } from "./components";

/**
 * De factuurpagina wacht op acht Convex-queries tegelijk (factuur, project,
 * offerte, nacalculatie, herinneringen, creditnota, aanmaningstatus,
 * boekhoudsync) en is dus juist de route waar de laadtijd merkbaar is.
 * We tonen hier dezelfde FactuurPageSkeleton als page.tsx, zodat er geen
 * sprong zit tussen de route-fallback en de eigen laadstatus van de pagina.
 */
export default function ProjectFactuurLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Projecten / <project> / Factuur */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>

      <FactuurPageSkeleton />
    </>
  );
}
