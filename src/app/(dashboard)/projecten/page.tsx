"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { useDebounce } from "@/hooks/use-debounce";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  Search,
  Calendar,
  Play,
  CheckCircle2,
  ClipboardCheck,
  Calculator,
  Plus,
} from "lucide-react";
import { ProjectenPageSkeleton, ListSkeleton } from "@/components/ui/skeleton-card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTable } from "@/components/ui/responsive-table";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useCurrentUser } from "@/hooks/use-current-user";
import { NoProjecten, NoSearchResults } from "@/components/empty-states";
import { FilterPresetSelector } from "@/components/ui/filter-preset-selector";
import {
  useFilterPresets,
  type ProjectenFilterState,
} from "@/hooks/use-filter-presets";
import { toast } from "sonner";
import {
  ExportDropdown,
  projectenExportColumns,
} from "@/components/export-dropdown";

// Status configuration - voorcalculatie is now at offerte level
// Projects start at "gepland" status
// Note: voorcalculatie kept for backwards compatibility with existing projects
// WCAG AA compliant colors (4.5:1 contrast ratio)
const statusConfig = {
  voorcalculatie: {
    label: "Voorcalculatie",
    icon: Calculator,
    color:
      "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  gepland: {
    label: "Gepland",
    icon: Calendar,
    color:
      "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  in_uitvoering: {
    label: "In Uitvoering",
    icon: Play,
    color:
      "bg-orange-200 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  afgerond: {
    label: "Afgerond",
    icon: CheckCircle2,
    color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  nacalculatie_compleet: {
    label: "Nacalculatie",
    icon: ClipboardCheck,
    color: "bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
};

type ProjectStatus = keyof typeof statusConfig;

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = statusConfig[status] || statusConfig.gepland;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.color}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export default function ProjectenPage() {
  return (
    <Suspense fallback={<ProjectenPageLoader />}>
      <ProjectenPageContent />
    </Suspense>
  );
}

function ProjectenPageLoader() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <ProjectenPageSkeleton />
      </div>
    </>
  );
}

function ProjectenPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const { user, isLoading: isUserLoading } = useCurrentUser();

  // Pagination state from URL params
  const [page, setPage] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? parseInt(pageParam, 10) : 1;
  });
  const [limit, setLimit] = useState(() => {
    const limitParam = searchParams.get("limit");
    return limitParam ? parseInt(limitParam, 10) : 25;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState("alle");

  // Update URL when pagination changes
  const updateUrl = useCallback((newPage: number, newLimit: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    params.set("limit", newLimit.toString());
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    updateUrl(newPage, limit);
  }, [limit, updateUrl]);

  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    updateUrl(1, newLimit);
  }, [updateUrl]);

  // Status filter for paginated query
  const statusFilter = activeTab !== "alle" ? activeTab as "gepland" | "in_uitvoering" | "afgerond" | "nacalculatie_compleet" | "gefactureerd" : undefined;

  // Use paginated query
  const paginatedData = useQuery(
    api.projecten.listPaginated,
    user?._id ? { page, limit, status: statusFilter } : "skip"
  );

  // Also fetch full list for stats and other features (non-paginated)
  const projecten = useQuery(
    api.projecten.list,
    user?._id ? {} : "skip"
  );
  const stats = useQuery(api.projecten.getStats, user?._id ? {} : "skip");
  const geaccepteerdeOffertes = useQuery(
    api.offertes.listByStatus,
    user?._id ? { status: "geaccepteerd" } : "skip"
  );

  // Use server-side search for better performance and searching by offerte nummer/klant naam
  const searchResults = useQuery(
    api.projecten.search,
    user?._id && debouncedSearchQuery.trim() ? { searchTerm: debouncedSearchQuery } : "skip"
  );

  // Filter presets
  const {
    presets,
    defaultPresets,
    userPresets,
    addPreset,
    deletePreset,
  } = useFilterPresets<ProjectenFilterState>("projecten");

  // Export data query
  const exportData = useQuery(api.export.exportProjecten, user?._id ? {} : "skip");

  const isLoading = isUserLoading || paginatedData === undefined;

  // Get offertes without projects
  const offertesZonderProject = useMemo(() => {
    if (!geaccepteerdeOffertes || !projecten) return [];

    const projectOfferteIds = new Set(projecten.map((p) => p.offerteId));
    return geaccepteerdeOffertes.filter(
      (o) => !projectOfferteIds.has(o._id)
    );
  }, [geaccepteerdeOffertes, projecten]);

  // Get items to display - use search results when searching, otherwise use paginated data
  const displayedProjecten = useMemo(() => {
    // Use search results if we have a search query (search is not paginated)
    if (debouncedSearchQuery.trim() && searchResults) {
      // Filter by status tab for search results
      return searchResults.filter((project) => {
        return activeTab === "alle" || project.status === activeTab;
      });
    }

    // Otherwise use paginated data (already filtered by status on server)
    return paginatedData?.items ?? [];
  }, [paginatedData, searchResults, debouncedSearchQuery, activeTab]);

  // Reset to page 1 when changing tabs (status filter changes)
  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    setPage(1);
    updateUrl(1, limit);
  }, [limit, updateUrl]);

  const handleNavigate = useCallback(
    (projectId: string) => {
      router.push(`/projecten/${projectId}`);
    },
    [router]
  );

  // Handle preset selection
  const handlePresetSelect = useCallback((presetFilters: ProjectenFilterState) => {
    if (presetFilters.status) {
      const statuses = presetFilters.status.split(",");
      if (statuses.length === 1) {
        setActiveTab(statuses[0]);
      } else {
        // For multiple statuses, stay on "alle" but we could filter client-side
        setActiveTab("alle");
      }
    } else {
      setActiveTab("alle");
    }
    if (presetFilters.searchQuery) {
      setSearchQuery(presetFilters.searchQuery);
    }
  }, []);

  // Current filters for preset
  const currentFiltersForPreset = useMemo((): ProjectenFilterState => ({
    status: activeTab !== "alle" ? activeTab : undefined,
    searchQuery: searchQuery || undefined,
  }), [activeTab, searchQuery]);

  // Check if there are active filters
  const hasActiveFilters = useMemo(() => {
    return activeTab !== "alle" || searchQuery !== "";
  }, [activeTab, searchQuery]);

  // Handle saving preset
  const handleSavePreset = useCallback((name: string, presetFilters: ProjectenFilterState) => {
    addPreset(name, presetFilters);
    toast.success(`Preset "${name}" opgeslagen`);
  }, [addPreset]);

  // Handle deleting preset
  const handleDeletePreset = useCallback((id: string) => {
    deletePreset(id);
    toast.success("Preset verwijderd");
  }, [deletePreset]);

  return (
    <>
      <PageHeader />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.1,
          }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Projecten
            </h1>
            <p className="text-muted-foreground">
              Calculatie, planning en nacalculatie voor je projecten
            </p>
          </div>
          <ExportDropdown
            getData={() => exportData ?? []}
            columns={projectenExportColumns}
            filename="projecten"
            sheetName="Projecten"
            disabled={!exportData || exportData.length === 0}
          />
        </motion.div>

        {/* Accepted offertes without project */}
        {offertesZonderProject.length > 0 && (
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.4,
              delay: reducedMotion ? 0 : 0.15,
            }}
          >
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Geaccepteerde offertes zonder project
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {offertesZonderProject.map((offerte) => (
                    <Button
                      key={offerte._id}
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link
                        href={`/projecten/nieuw?offerte=${offerte._id}`}
                      >
                        <FolderKanban className="h-3.5 w-3.5 mr-1.5" />
                        {offerte.offerteNummer} - {offerte.klant.naam}
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.2,
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {Object.entries(statusConfig)
            .filter(([status]) => status !== "voorcalculatie") // Skip legacy status in stats grid
            .map(([status, config]) => {
            const Icon = config.icon;
            const count = stats?.[status as Exclude<ProjectStatus, "voorcalculatie">] ?? 0;

            return (
              <Card
                key={status}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() =>
                  setActiveTab(activeTab === status ? "alle" : status)
                }
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">
                        {config.label}
                      </p>
                    </div>
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center ${config.color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>

        {/* Search */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.25,
          }}
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative w-full sm:flex-1 sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoeken..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <FilterPresetSelector<ProjectenFilterState>
              presets={presets}
              defaultPresets={defaultPresets}
              userPresets={userPresets}
              currentFilters={currentFiltersForPreset}
              onSelectPreset={handlePresetSelect}
              onSavePreset={handleSavePreset}
              onDeletePreset={handleDeletePreset}
              hasActiveFilters={hasActiveFilters}
            />
          </div>
        </motion.div>

        {/* Projects list */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.3,
          }}
        >
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-6"
          >
            <TabsList>
              <TabsTrigger value="alle">
                Alle
                <Badge variant="secondary" className="ml-2">
                  {stats?.totaal || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="gepland">Gepland</TabsTrigger>
              <TabsTrigger value="in_uitvoering">In Uitvoering</TabsTrigger>
              <TabsTrigger value="afgerond">Afgerond</TabsTrigger>
              <TabsTrigger value="nacalculatie_compleet">Nacalculatie</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-6">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reducedMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.2 }}
                    className="py-4"
                  >
                    <ListSkeleton count={5} />
                  </motion.div>
                ) : displayedProjecten.length > 0 ? (
                  <motion.div
                    key="content"
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: reducedMotion ? 0 : 0.4 }}
                  >
                    <Card className="overflow-hidden">
                      <ScrollableTable>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Project</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Aangemaakt</TableHead>
                              <TableHead>Laatst gewijzigd</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {displayedProjecten.map((project) => (
                              <TableRow
                                key={project._id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleNavigate(project._id)}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <FolderKanban className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                      <p className="font-medium">
                                        {project.naam}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <StatusBadge
                                    status={project.status as ProjectStatus}
                                  />
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(project.createdAt)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(project.updatedAt)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTable>
                      {/* Pagination - only show when not searching */}
                      {!debouncedSearchQuery.trim() && paginatedData && paginatedData.totalCount > 0 && (
                        <Pagination
                          page={page}
                          totalCount={paginatedData.totalCount}
                          limit={limit}
                          onPageChange={handlePageChange}
                          onLimitChange={handleLimitChange}
                          className="border-t px-4"
                        />
                      )}
                    </Card>
                  </motion.div>
                ) : searchQuery ? (
                  <motion.div
                    key="no-results"
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reducedMotion ? undefined : { opacity: 0, scale: 0.95 }
                    }
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                  >
                    <NoSearchResults onAction={() => setSearchQuery("")} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reducedMotion ? undefined : { opacity: 0, scale: 0.95 }
                    }
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                  >
                    <NoProjecten onAction={() => router.push("/offertes?status=geaccepteerd")} />
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </>
  );
}
