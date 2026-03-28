"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Euro } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProjectKostenDashboard } from "@/components/project/project-kosten-dashboard";
import { ProjectKostenSkeleton } from "@/components/skeletons";

export default function ProjectKostenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = id as Id<"projecten">;

  // Get project details for breadcrumb
  const projectDetails = useQuery(
    api.projecten.getWithDetails,
    projectId ? { id: projectId } : "skip"
  );

  // Loading state
  if (projectDetails === undefined) {
    return (
      <>
        <PageHeader />
        <ProjectKostenSkeleton />
      </>
    );
  }

  if (!projectDetails) {
    return (
      <>
        <PageHeader customLabels={{ [`/projecten/${id}/kosten`]: "Niet gevonden" }} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Euro className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-lg font-medium">Project niet gevonden</h2>
          <Button variant="outline" asChild>
            <Link href="/projecten">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Terug naar projecten
            </Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader customLabels={{ [`/projecten/${id}`]: projectDetails.project?.naam || "Project" }} />

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        {/* Page Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Terug naar project">
            <Link href={`/projecten/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Euro className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                Kosten Tracking
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {projectDetails.project?.naam}
            </p>
          </div>
        </div>

        {/* Kosten Dashboard */}
        <ProjectKostenDashboard projectId={id} />
      </div>
    </>
  );
}
