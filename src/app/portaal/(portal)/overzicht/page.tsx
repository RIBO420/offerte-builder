"use client";

import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PortaalKpiCards } from "@/components/portaal/portaal-kpi-cards";
import { PortaalActivityFeed } from "@/components/portaal/portaal-activity-feed";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortaalOverzichtPage() {
  const { isAuthenticated } = useConvexAuth();
  const overzicht = useQuery(
    api.portaal.getOverzicht,
    isAuthenticated ? undefined : "skip"
  );

  if (!overzicht) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        {/* Grootste sfeerkop van het portaal: Playfair (huisstijl), met het
            gouden lijntje als accent. */}
        <h1 className="font-sfeer text-3xl md:text-4xl font-normal leading-tight text-foreground text-balance">
          Welkom, {overzicht.klantNaam}
        </h1>
        <div aria-hidden="true" className="mt-3 h-0.5 w-12 bg-accent-warm" />
        <p className="text-sm text-muted-foreground mt-3">
          Hier vindt u een overzicht van uw tuinprojecten bij Top Tuinen.
        </p>
      </div>

      <PortaalKpiCards data={overzicht.kpis} />
      <PortaalActivityFeed items={overzicht.activity} />
    </div>
  );
}
