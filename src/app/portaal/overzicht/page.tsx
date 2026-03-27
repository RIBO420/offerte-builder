"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PortaalKpiCards } from "@/components/portaal/portaal-kpi-cards";
import { PortaalActivityFeed } from "@/components/portaal/portaal-activity-feed";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortaalOverzichtPage() {
  const overzicht = useQuery(api.portaal.getOverzicht);

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
        <h1 className="text-xl md:text-2xl font-bold text-[#1a2e1a] dark:text-white">
          Welkom, {overzicht.klantNaam}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Hier vindt u een overzicht van uw tuinprojecten bij Top Tuinen.
        </p>
      </div>

      <PortaalKpiCards data={overzicht.kpis} />
      <PortaalActivityFeed items={overzicht.activity} />
    </div>
  );
}
