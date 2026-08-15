"use client";

/**
 * Silhouet van het werkblad tijdens het laden — zelfde indeling als het
 * echte scherm, zodat er niets verspringt zodra het concept er is.
 */

import { PageHeader } from "@/components/page-header";

export function WerkbankSkelet() {
  return (
    <>
      <PageHeader />
      <div className="@container/werkbank flex flex-1 flex-col gap-4 p-4 md:p-6">
        <header className="border-b pb-4">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-40 animate-pulse rounded bg-muted/70" />
        </header>
        <div className="flex flex-col gap-5 @min-[68rem]/werkbank:grid @min-[68rem]/werkbank:grid-cols-[minmax(0,1fr)_20.5rem] @min-[68rem]/werkbank:items-start @min-[68rem]/werkbank:gap-6">
          <div className="order-1 h-64 animate-pulse rounded-lg border bg-card @min-[68rem]/werkbank:order-2" />
          <div className="order-2 space-y-3 @min-[68rem]/werkbank:order-1">
            <div className="h-24 animate-pulse rounded-lg border bg-card" />
            <div className="h-10 animate-pulse rounded-lg border bg-card" />
            <div className="h-40 animate-pulse rounded-lg border bg-card" />
          </div>
        </div>
      </div>
    </>
  );
}
