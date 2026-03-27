"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { PortaalFactuurCard } from "@/components/portaal/portaal-factuur-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, Inbox } from "lucide-react";

function FacturenSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-44 mt-1.5" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-7 w-24 mt-4" />
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PortaalFacturenPage() {
  const facturen = useQuery(api.portaal.getFacturen);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#4ADE80]/10 p-2">
          <Receipt className="h-6 w-6 text-[#4ADE80]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Facturen
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bekijk en betaal uw facturen
          </p>
        </div>
      </div>

      {facturen === undefined ? (
        <FacturenSkeleton />
      ) : facturen.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
            <Inbox className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Geen facturen
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            Er zijn nog geen facturen beschikbaar. Facturen verschijnen hier
            zodra ze door Top Tuinen zijn verstuurd.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {facturen.map((factuur) => (
            <PortaalFactuurCard key={factuur._id} factuur={factuur} />
          ))}
        </div>
      )}
    </div>
  );
}
