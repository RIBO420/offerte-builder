"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Calendar, GripVertical, X, Plus,
} from "lucide-react";

// ============================================
// Helpers
// ============================================

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateStr(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getWeekDays(monday: Date): { date: Date; dateStr: string; label: string; dagKort: string }[] {
  const dagNamen = ["Ma", "Di", "Wo", "Do", "Vr"];
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      date: d,
      dateStr: formatDateStr(d),
      label: `${d.getDate()} ${d.toLocaleDateString("nl-NL", { month: "short" })}`,
      dagKort: dagNamen[i],
    };
  });
}

function getWeekLabel(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const weekNr = getWeekNumber(monday);
  return `Week ${weekNr} — ${monday.getDate()} ${monday.toLocaleDateString("nl-NL", { month: "short" })} t/m ${friday.getDate()} ${friday.toLocaleDateString("nl-NL", { month: "short", year: "numeric" })}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

// Project colors for visual distinction
const PROJECT_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700",
  "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/50 dark:text-green-200 dark:border-green-700",
  "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-700",
  "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700",
  "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-200 dark:border-rose-700",
  "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-200 dark:border-cyan-700",
  "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-700",
];

// ============================================
// Component
// ============================================

export default function WeekPlannerPage() {
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [addingCell, setAddingCell] = useState<{ medewerkerId: string; datum: string } | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");

  const weekDays = useMemo(() => getWeekDays(currentMonday), [currentMonday]);
  const startDatum = weekDays[0].dateStr;
  const eindDatum = weekDays[4].dateStr;

  // Queries
  const toewijzingen = useQuery(api.weekPlanning.getWeek, { startDatum, eindDatum });
  const medewerkers = useQuery(api.weekPlanning.getMedewerkers);
  const projecten = useQuery(api.weekPlanning.getActiveProjects);

  // Mutations
  const assignMutation = useMutation(api.weekPlanning.assign);
  const moveMutation = useMutation(api.weekPlanning.move);
  const removeMutation = useMutation(api.weekPlanning.remove);

  // Project color map
  const projectColorMap = useMemo(() => {
    const map = new Map<string, string>();
    projecten?.forEach((p, i) => {
      map.set(p._id, PROJECT_COLORS[i % PROJECT_COLORS.length]);
    });
    return map;
  }, [projecten]);

  // Navigation
  const goToPrevWeek = useCallback(() => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const goToThisWeek = useCallback(() => {
    setCurrentMonday(getMonday(new Date()));
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData("text/plain", itemId);
    e.dataTransfer.effectAllowed = "move";
    setDragItem(itemId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, medewerkerId: string, datum: string) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData("text/plain");
      setDragItem(null);

      if (itemId.startsWith("project:")) {
        // Dropping a new project from sidebar
        const projectId = itemId.replace("project:", "");
        await assignMutation({
          medewerkerId: medewerkerId as Id<"medewerkers">,
          projectId: projectId as Id<"projecten">,
          datum,
        });
      } else {
        // Moving an existing assignment
        await moveMutation({
          id: itemId as Id<"weekPlanning">,
          medewerkerId: medewerkerId as Id<"medewerkers">,
          datum,
        });
      }
    },
    [assignMutation, moveMutation]
  );

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
  }, []);

  const handleAdd = useCallback(
    async (medewerkerId: string, datum: string, projectId: string) => {
      await assignMutation({
        medewerkerId: medewerkerId as Id<"medewerkers">,
        projectId: projectId as Id<"projecten">,
        datum,
      });
      setAddingCell(null);
      setSelectedProject("");
    },
    [assignMutation]
  );

  // Get assignments for a specific cell
  const getAssignments = useCallback(
    (medewerkerId: string, datum: string) => {
      return toewijzingen?.filter(
        (t) => t.medewerkerId === medewerkerId && t.datum === datum
      ) ?? [];
    },
    [toewijzingen]
  );

  const isLoading = toewijzingen === undefined || medewerkers === undefined || projecten === undefined;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink href="/planning">Planning</BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Weekplanner</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {/* Header with navigation */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={goToPrevWeek} aria-label="Vorige week">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <h1 className="text-lg font-bold">{getWeekLabel(currentMonday)}</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={goToNextWeek} aria-label="Volgende week">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={goToThisWeek}>
              <Calendar className="mr-1 h-3.5 w-3.5" />
              Vandaag
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/planning">Overzicht</Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Main grid */}
            <div className="flex-1 overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Day headers */}
                <div className="grid gap-px bg-muted" style={{ gridTemplateColumns: "180px repeat(5, 1fr)" }}>
                  <div className="bg-background p-2 text-sm font-medium text-muted-foreground">
                    Medewerker
                  </div>
                  {weekDays.map((day) => (
                    <div
                      key={day.dateStr}
                      className={`bg-background p-2 text-center text-sm font-medium ${
                        day.dateStr === formatDateStr(new Date())
                          ? "bg-primary/5 text-primary"
                          : ""
                      }`}
                    >
                      <span className="font-bold">{day.dagKort}</span>{" "}
                      <span className="text-muted-foreground">{day.label}</span>
                    </div>
                  ))}
                </div>

                {/* Rows per medewerker */}
                {medewerkers.map((mw) => (
                  <div
                    key={mw._id}
                    className="grid gap-px bg-muted"
                    style={{ gridTemplateColumns: "180px repeat(5, 1fr)" }}
                  >
                    {/* Medewerker label */}
                    <div className="bg-background p-2">
                      <p className="text-sm font-medium truncate">{mw.naam}</p>
                      {mw.functie && (
                        <p className="text-[10px] text-muted-foreground">{mw.functie}</p>
                      )}
                    </div>

                    {/* Day cells */}
                    {weekDays.map((day) => {
                      const cellAssignments = getAssignments(mw._id, day.dateStr);
                      const isToday = day.dateStr === formatDateStr(new Date());
                      const isAddingHere =
                        addingCell?.medewerkerId === mw._id && addingCell?.datum === day.dateStr;

                      return (
                        <div
                          key={day.dateStr}
                          className={`min-h-[70px] bg-background p-1 transition-colors ${
                            isToday ? "bg-primary/5" : ""
                          } ${dragItem ? "ring-1 ring-inset ring-primary/20" : ""}`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, mw._id, day.dateStr)}
                        >
                          {cellAssignments.map((a) => (
                            <div
                              key={a._id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, a._id)}
                              onDragEnd={handleDragEnd}
                              className={`group mb-1 flex items-center gap-1 rounded border px-1.5 py-1 text-xs cursor-grab active:cursor-grabbing ${
                                projectColorMap.get(a.projectId) ?? PROJECT_COLORS[0]
                              } ${dragItem === a._id ? "opacity-40" : ""}`}
                            >
                              <GripVertical className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50" />
                              <span className="flex-1 truncate font-medium">
                                {a.projectNaam}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeMutation({ id: a._id });
                                }}
                                className="shrink-0 opacity-0 group-hover:opacity-70 hover:opacity-100"
                                aria-label="Verwijder"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}

                          {/* Add button / inline select */}
                          {isAddingHere ? (
                            <div className="mt-1">
                              <Select
                                value={selectedProject}
                                onValueChange={(v) => {
                                  handleAdd(mw._id, day.dateStr, v);
                                }}
                              >
                                <SelectTrigger className="h-7 text-[10px]">
                                  <SelectValue placeholder="Project..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {projecten.map((p) => (
                                    <SelectItem key={p._id} value={p._id}>
                                      {p.naam}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                setAddingCell({ medewerkerId: mw._id, datum: day.dateStr })
                              }
                              className="mt-1 flex h-6 w-full items-center justify-center rounded border border-dashed border-transparent text-muted-foreground/30 transition-colors hover:border-muted-foreground/30 hover:text-muted-foreground/60"
                              aria-label="Toevoegen"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Project sidebar — drag source */}
            <Card className="hidden w-48 shrink-0 lg:block">
              <CardContent className="p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Projecten (sleep naar grid)
                </p>
                <div className="space-y-1">
                  {projecten.map((p) => (
                    <div
                      key={p._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, `project:${p._id}`)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-1 rounded border px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing ${
                        projectColorMap.get(p._id) ?? PROJECT_COLORS[0]
                      }`}
                    >
                      <GripVertical className="h-3 w-3 shrink-0 opacity-50" />
                      <span className="truncate font-medium">{p.naam}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
