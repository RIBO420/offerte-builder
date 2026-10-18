"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

/**
 * Lege tak voor een projectsubpagina waarvan het project niet (meer) bestaat
 * of niet bij deze organisatie hoort (`getWithDetails` gaf null). Zelfde
 * opbouw als op het projectoverzicht.
 */
export function ProjectNietGevonden({ projectId, pad }: { projectId: string; pad: string }) {
  return (
    <>
      <PageHeader customLabels={{ [`/projecten/${projectId}/${pad}`]: "Niet gevonden" }} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <FileText className="size-12 text-muted-foreground/50" aria-hidden="true" />
        <h2 className="font-display text-lg font-medium">Project niet gevonden</h2>
        <Button variant="outline" asChild>
          <Link href="/projecten">
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
            Terug naar projecten
          </Link>
        </Button>
      </div>
    </>
  );
}
