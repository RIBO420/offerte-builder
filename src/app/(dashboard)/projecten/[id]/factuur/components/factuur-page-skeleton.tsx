import { Skeleton } from "@/components/ui/skeleton";

/** Laadstaat in de vorm van de pagina: kop, stappenbalk, papier en zijkolom. */
export function FactuurPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-8" aria-busy="true">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-11 w-full" />
      </div>

      <Skeleton className="h-[54px] w-full rounded-lg" />

      <div className="@container/werk">
        <div className="grid items-start gap-5 @4xl/werk:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <div className="flex min-w-0 flex-col gap-2.5">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-80 w-full rounded-lg" />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
