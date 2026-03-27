"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen,
  ArrowLeft,
  Calendar,
  MessageSquare,
  Download,
} from "lucide-react";
import { PortaalProjectProgress } from "@/components/portaal/portaal-project-progress";
import { cn } from "@/lib/utils";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

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

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36 mt-1" />
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-2 w-full rounded-full mb-6" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-20 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PortaalProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const project = useQuery(api.portaal.getProject, {
    id: id as Id<"projecten">,
  });

  if (project === undefined) {
    return <DetailSkeleton />;
  }

  if (project === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Project niet gevonden
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Dit project bestaat niet of u heeft geen toegang.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/portaal/projecten">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Terug naar projecten
          </Link>
        </Button>
      </div>
    );
  }

  const statusConfig = getProjectStatusConfig(project.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0 mt-0.5">
          <Link href="/portaal/projecten">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {project.naam}
            </h1>
            <Badge className={cn("border", statusConfig.className)}>
              {statusConfig.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Aangemaakt op {formatDate(project.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <Card className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-[#4ADE80]" />
            Voortgang
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PortaalProjectProgress
            status={project.status}
            scopes={project.scopes}
          />
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card className="border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-white">
            Snelle acties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="default" className="bg-[#4ADE80] hover:bg-[#3BC96F] text-black">
              <Link href="/portaal/chat">
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Bericht sturen
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-gray-200 dark:border-[#2a3e2a]">
              <Link href="/portaal/documenten">
                <Download className="h-4 w-4 mr-1.5" />
                Documenten bekijken
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
