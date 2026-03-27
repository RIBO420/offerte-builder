"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, Eye, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

function getProjectStatusConfig(status: string) {
  switch (status) {
    case "afgerond":
    case "opgeleverd":
      return {
        label: status === "afgerond" ? "Afgerond" : "Opgeleverd",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
      };
    case "in_uitvoering":
      return {
        label: "In uitvoering",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      };
    case "voorcalculatie":
      return {
        label: "Voorcalculatie",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      };
    default:
      return {
        label: status,
        className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
      };
  }
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function ProjectenSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] p-5">
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

export default function PortaalProjectenPage() {
  const projecten = useQuery(api.portaal.getProjecten);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[#4ADE80]/10 p-2">
          <FolderOpen className="h-6 w-6 text-[#4ADE80]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Projecten
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Volg de voortgang van uw projecten
          </p>
        </div>
      </div>

      {projecten === undefined ? (
        <ProjectenSkeleton />
      ) : projecten.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4 mb-4">
            <Inbox className="h-8 w-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Geen projecten
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            Er zijn nog geen lopende projecten. Zodra een geaccepteerde offerte
            wordt omgezet naar een project, verschijnt het hier.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {projecten.map((project) => {
            const statusConfig = getProjectStatusConfig(project.status);
            return (
              <Card
                key={project._id}
                className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] transition-shadow hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="rounded-lg bg-[#4ADE80]/10 p-2 shrink-0">
                        <FolderOpen className="h-5 w-5 text-[#4ADE80]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {project.naam}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          Aangemaakt op {formatDate(project.createdAt)}
                        </p>
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
                      className="bg-[#4ADE80] hover:bg-[#3BC96F] text-black"
                    >
                      <Link href={`/portaal/projecten/${project._id}`}>
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
