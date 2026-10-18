"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Euro, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProjectKop } from "@/components/project/project-kop";
import {
  ProjectKostenDashboard,
  useKostenToevoegen,
} from "@/components/project/project-kosten-dashboard";
import { ProjectKostenSkeleton } from "@/components/skeletons";
import { REVEAL_KLASSE } from "@/components/pagina-reveal";

export default function ProjectKostenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = id as Id<"projecten">;
  const toevoegen = useKostenToevoegen();

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

      <div className={`${REVEAL_KLASSE} flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6`}>
        <ProjectKop
          projectId={id}
          actief="kosten"
          acties={
            <Button onClick={() => toevoegen.openen()}>
              <Plus className="size-4" aria-hidden="true" />
              Kosten toevoegen
            </Button>
          }
        />

        <ProjectKostenDashboard projectId={id} toevoegen={toevoegen} />
      </div>
    </>
  );
}
