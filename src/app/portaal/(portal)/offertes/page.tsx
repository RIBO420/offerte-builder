"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PortaalOfferteCard } from "@/components/portaal/portaal-offerte-card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Inbox } from "lucide-react";

function OffertesSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48 mt-1.5" />
              </div>
            </div>
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="h-7 w-24 mt-4" />
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PortaalOffertesPage() {
  const offertes = useQuery(api.portaal.getOffertes);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#4ADE80]/10 p-2">
          <FileText className="h-6 w-6 text-[#4ADE80]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Offertes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bekijk en reageer op uw offertes
          </p>
        </div>
      </div>

      {offertes === undefined ? (
        <OffertesSkeleton />
      ) : offertes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
            <Inbox className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Geen offertes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            Er zijn nog geen offertes voor u beschikbaar. Zodra Top Tuinen een
            offerte opstelt, verschijnt deze hier.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {offertes.map((offerte) => (
            <PortaalOfferteCard key={offerte._id} offerte={offerte} />
          ))}
        </div>
      )}
    </div>
  );
}
