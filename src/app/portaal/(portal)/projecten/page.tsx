"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Leaf, Eye, Inbox, CalendarDays, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

function getWerkitemStatusConfig(status: string) {
  switch (status) {
    case "afgerond":
    case "uitgevoerd":
    case "gefactureerd":
    case "nacalculatie_compleet":
      return {
        label: status === "uitgevoerd" ? "Uitgevoerd" : "Afgerond",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
      };
    case "deels_uitgevoerd":
      return {
        label: "Deels uitgevoerd",
        className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800",
      };
    case "in_uitvoering":
      return {
        label: "In uitvoering",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      };
    case "vervallen":
      return {
        label: "Vervallen",
        className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700",
      };
    case "gepland":
    case "voorcalculatie":
      return {
        label: "Gepland",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      };
    default:
      return {
        label: status,
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
      };
  }
}

function formatGeplandeDatum(datum: string): string {
  const parsed = new Date(`${datum}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return datum;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function WerkitemsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-32 mt-1.5" />
              </div>
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PortaalWerkzaamhedenPage() {
  const werkitems = useQuery(api.portaal.getWerkitems);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <FolderOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Werkzaamheden
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Uw projecten en onderhoudsbeurten
          </p>
        </div>
      </div>

      {werkitems === undefined ? (
        <WerkitemsSkeleton />
      ) : werkitems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
            <Inbox className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Geen werkzaamheden
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            Er zijn nog geen geplande projecten of onderhoudsbeurten. Zodra er
            iets voor u wordt ingepland, verschijnt het hier.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {werkitems.map((item) => {
            const statusConfig = getWerkitemStatusConfig(item.status);
            const isBeurt = item.type === "onderhoudsbeurt";
            return (
              <Card
                key={item._id}
                className="border border-border bg-card transition-shadow hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                        {isBeurt ? (
                          <Leaf className="h-5 w-5 text-primary" />
                        ) : (
                          <FolderOpen className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {item.naam}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {isBeurt ? "Onderhoudsbeurt" : "Project"}
                        </p>
                        {item.geplandeStart && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 text-primary" />
                            Gepland op {formatGeplandeDatum(item.geplandeStart)}
                          </p>
                        )}
                        {item.adres && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {item.adres}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge className={cn("shrink-0 border", statusConfig.className)}>
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="bg-primary hover:bg-primary/85 text-primary-foreground"
                    >
                      <Link href={`/portaal/projecten/${item._id}`}>
                        <Eye className="h-4 w-4 mr-1.5" />
                        Bekijken
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
