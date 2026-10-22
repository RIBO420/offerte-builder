"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FolderKanban,
  ExternalLink,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_CONFIG, type ProjectStatus } from "./types";

interface ProjectCardProps {
  id: string;
  offerteStatus: string;
  existingProject: {
    _id: string;
    naam: string;
    status: string;
  } | null | undefined;
}

export function ProjectCard({ id, offerteStatus, existingProject }: ProjectCardProps) {
  return (
    <Card
      variant="elevated"
      className={cn(
        "transition-[border-color,background-color,box-shadow]",
        existingProject
          ? "border-status-geaccepteerd-border bg-status-geaccepteerd/50 hover:border-status-geaccepteerd-dot hover:shadow-md"
          : offerteStatus === "geaccepteerd"
            ? "border-status-herinnering-border bg-surface-aandacht/40"
            : "border-muted"
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderKanban className={cn(
            "h-4 w-4",
            existingProject
              ? "text-status-geaccepteerd-text"
              : offerteStatus === "geaccepteerd"
                ? "text-status-herinnering-text"
                : "text-muted-foreground"
          )} />
          Project
          {existingProject && (
            <span className={cn(
              "ml-auto text-xs px-2 py-0.5 rounded-full font-medium",
              PROJECT_STATUS_CONFIG[existingProject.status as ProjectStatus]?.bgColor,
              PROJECT_STATUS_CONFIG[existingProject.status as ProjectStatus]?.color
            )}>
              {PROJECT_STATUS_CONFIG[existingProject.status as ProjectStatus]?.label || existingProject.status}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {existingProject === undefined ? (
          // Loading state
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : existingProject ? (
          // Project exists - show project info
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="font-medium text-sm">{existingProject.naam}</p>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-status-geaccepteerd-text" />
                <span className="text-sm text-status-geaccepteerd-text">
                  Project actief
                </span>
              </div>
            </div>
            <Button
              asChild
              className="w-full group"
            >
              <Link href={`/projecten/${existingProject._id}`}>
                <FolderKanban className="mr-2 h-4 w-4" />
                Bekijk Project
                <ExternalLink className="ml-2 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </Button>
          </div>
        ) : offerteStatus === "geaccepteerd" ? (
          // No project, but offerte is accepted - show start project button
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Deze offerte is geaccepteerd. Start een project om de voorcalculatie, planning en nacalculatie te beheren.
            </p>
            <Button
              asChild
              className="w-full"
            >
              <Link href={`/projecten/nieuw?offerte=${id}`}>
                <FolderKanban className="mr-2 h-4 w-4" />
                Start Project
              </Link>
            </Button>
          </div>
        ) : (
          // Offerte is not accepted yet
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Accepteer de offerte om een project te kunnen starten.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              disabled
            >
              <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
              Start Project
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
