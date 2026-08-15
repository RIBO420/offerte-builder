"use client";
import { klantNaam } from "@convex/lib/offerteKlant";

import { useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PaginaReveal } from "@/components/pagina-reveal";
import { useDebounce } from "@/hooks/use-debounce";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  Search,
  Plus,
} from "lucide-react";
import { ProjectenPageSkeleton } from "@/components/ui/skeleton-card";
import { ProjectenTabelSkelet } from "./components/projecten-tabel-skelet";
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
import { useIsKantoor } from "@/hooks/use-users";
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
import { PROJECT_STATUS_CONFIG, statusClasses } from "@/lib/constants/statuses";

// Statuskleuren uit de centrale bron (WS4): zelfde status = zelfde kleur.
// Dit scherm toont bewust alleen deze statussen (zelfde keys als voorheen);
// voorcalculatie blijft erin voor bestaande projecten.
const statusConfig = {
  voorcalculatie: PROJECT_STATUS_CONFIG.voorcalculatie,
  gepland: PROJECT_STATUS_CONFIG.gepland,
  in_uitvoering: PROJECT_STATUS_CONFIG.in_uitvoering,
  afgerond: PROJECT_STATUS_CONFIG.afgerond,
  nacalculatie_compleet: PROJECT_STATUS_CONFIG.nacalculatie_compleet,
} as const;

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
    <Badge variant="outline" className={statusClasses(config)}>
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
  const { user, isLoading: isUserLoading } = useCurrentUser();

  // Initialize filter state from URL search params
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState(searchParams.get("status") || "alle");

  // Cursor-based pagination state
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previousItems, setPreviousItems] = useState<any[]>([]);

  // Status filter for paginated query
  const statusFilter = activeTab !== "alle" ? activeTab as "gepland" | "in_uitvoering" | "afgerond" | "nacalculatie_compleet" | "gefactureerd" : undefined;

  // Use cursor-based paginated query
  const paginatedData = useQuery(
    api.projecten.listPaginated,
    user?._id ? { limit: 25, cursor, status: statusFilter } : "skip"
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

  // Export is kantoor-functionaliteit (PRD §1.2): de admin-only query wordt
  // voor andere rollen niet aangeroepen (skip) zodat de pagina gewoon laadt.
  const isKantoor = useIsKantoor();
  const exportData = useQuery(
    api.export.exportProjecten,
    user?._id && isKantoor ? {} : "skip"
  );

  const isLoading = isUserLoading || paginatedData === undefined;

  // Hoeveel rijen het skelet moet tekenen. `stats` is een losse query en is
  // meestal eerder binnen dan de gepagineerde lijst; dan staat het skelet exact
  // even hoog als de tabel die eroverheen komt. Bij zoeken zegt de teller niets
  // over het resultaat, dus dan laten we het skelet zijn eigen aanname doen.
  const skeletRijen = useMemo(() => {
    if (!stats || debouncedSearchQuery.trim()) return undefined;
    if (activeTab === "alle") return stats.totaal;
    return (stats as Record<string, number | undefined>)[activeTab];
  }, [stats, activeTab, debouncedSearchQuery]);

  // Get offertes without projects
  const offertesZonderProject = useMemo(() => {
    if (!geaccepteerdeOffertes || !projecten) return [];

    const projectOfferteIds = new Set(projecten.map((p) => p.offerteId));
    return geaccepteerdeOffertes.filter(
      (o) => !projectOfferteIds.has(o._id)
    );
  }, [geaccepteerdeOffertes, projecten]);

  // Accumulate items across cursor pages
  const allItems = useMemo(() => {
    if (!paginatedData) return previousItems;
    if (!cursor) return paginatedData.items;
    return [...previousItems, ...paginatedData.items];
  }, [paginatedData, cursor, previousItems]);

  // Get items to display - use search results when searching, otherwise use paginated data
  const displayedProjecten = useMemo(() => {
    // Use search results if we have a search query (search is not paginated)
    if (debouncedSearchQuery.trim() && searchResults) {
      // Filter by status tab for search results
      return searchResults.filter((project) => {
        return activeTab === "alle" || project.status === activeTab;
      });
    }

    // Otherwise use accumulated cursor-based paginated data
    return allItems;
  }, [allItems, searchResults, debouncedSearchQuery, activeTab]);

  // Handle "Meer laden" button
  const handleLoadMore = useCallback(() => {
    if (paginatedData?.nextCursor && paginatedData.hasMore) {
      setPreviousItems(allItems);
      setCursor(paginatedData.nextCursor);
    }
  }, [paginatedData, allItems]);

  // Update URL when filters change
  const updateUrlParams = useCallback((newStatus: string, newSearch: string) => {
    const params = new URLSearchParams();
    if (newStatus !== "alle") params.set("status", newStatus);
    if (newSearch) params.set("q", newSearch);

    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : "/projecten", { scroll: false });
  }, [router]);

  // Reset cursor when changing tabs (status filter changes)
  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    setCursor(undefined);
    setPreviousItems([]);
    updateUrlParams(newTab, searchQuery);
  }, [updateUrlParams, searchQuery]);

  // Sync search to URL
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    updateUrlParams(activeTab, value);
  }, [updateUrlParams, activeTab]);

  const handleNavigate = useCallback(
    (projectId: string) => {
      router.push(`/projecten/${projectId}`);
    },
    [router]
  );

  // Handle preset selection
  const handlePresetSelect = useCallback((presetFilters: ProjectenFilterState) => {
    let newTab = "alle";
    if (presetFilters.status) {
      const statuses = presetFilters.status.split(",");
      if (statuses.length === 1) {
        newTab = statuses[0];
      }
    }
    setActiveTab(newTab);
    const newSearch = presetFilters.searchQuery || "";
    setSearchQuery(newSearch);
    setCursor(undefined);
    setPreviousItems([]);
    updateUrlParams(newTab, newSearch);
  }, [updateUrlParams]);

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

      {/* Eén reveal op de buitenkant, geen gestapelde delays eronder: de blokken
          hieronder zijn gewone divs en staan er dus ook als er nul
          animatieframes vallen. → src/components/pagina-reveal.tsx */}
      <PaginaReveal className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Projecten
            </h1>
            <p className="text-muted-foreground">
              Calculatie, planning en nacalculatie voor je projecten
            </p>
          </div>
          {isKantoor && (
            <ExportDropdown
              getData={() => exportData ?? []}
              columns={projectenExportColumns}
              filename="projecten"
              sheetName="Projecten"
              disabled={!exportData || exportData.length === 0}
            />
          )}
        </div>

        {/* Accepted offertes without project */}
        {offertesZonderProject.length > 0 && (
          <div>
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
                        {offerte.offerteNummer} - {klantNaam(offerte.klant)}
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* KPI-cards vervallen (WS6): de statustabs hieronder tonen dezelfde
            vier tellers, mét filterfunctie. */}

        {/* Search */}
        <div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative w-full sm:flex-1 sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoeken..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
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
        </div>

        {/* Projects list */}
        <div>
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="space-y-6"
          >
            {/* Tellers in de tabs zelf — de vier KPI-cards erboven zijn weg */}
            <TabsList>
              <TabsTrigger value="alle">
                Alle
                <Badge variant="secondary" className="ml-2">
                  {stats?.totaal || 0}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="gepland">
                Gepland ({stats?.gepland ?? 0})
              </TabsTrigger>
              <TabsTrigger value="in_uitvoering">
                In Uitvoering ({stats?.in_uitvoering ?? 0})
              </TabsTrigger>
              <TabsTrigger value="afgerond">
                Afgerond ({stats?.afgerond ?? 0})
              </TabsTrigger>
              <TabsTrigger value="nacalculatie_compleet">
                Nacalculatie ({stats?.nacalculatie_compleet ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-6">
              {/* Geen `AnimatePresence` meer. Die hield met `mode="wait"` de
                  volgende staat tegen tot de vorige was uitgefaded — precies
                  het gat waarin de pagina leeg stond — en liet bovendien elk
                  blok op `opacity: 0` hangen zodra rAF stilstond. De takken
                  wisselen nu gewoon; de `key` op de reveal zorgt dat de
                  CSS-animatie opnieuw start, en zonder animatieframe staat de
                  inhoud er meteen. */}
              {isLoading ? (
                <div key="loading">
                  <ProjectenTabelSkelet aantal={skeletRijen} />
                </div>
              ) : displayedProjecten.length > 0 ? (
                <PaginaReveal key="content">
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
                                    {/* Echte link (patroon klanten-/offertetabel):
                                        toetsenbord, screenreader en cmd-klik
                                        werken; de rij-klik blijft als extra.
                                        stopPropagation zodat cmd-klik niet óók
                                        de huidige tab laat navigeren. */}
                                    <Link
                                      href={`/projecten/${project._id}`}
                                      className="font-medium hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {project.naam}
                                    </Link>
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
                      {/* Load More - only show when not searching and more data available */}
                      {!debouncedSearchQuery.trim() && paginatedData?.hasMore && (
                        <div className="border-t px-4 py-4 flex justify-center">
                          <Button
                            variant="outline"
                            onClick={handleLoadMore}
                            disabled={!paginatedData.hasMore}
                          >
                            Meer laden
                          </Button>
                        </div>
                      )}
                    </Card>
                </PaginaReveal>
              ) : searchQuery ? (
                <PaginaReveal key="no-results">
                  <NoSearchResults onAction={() => handleSearchChange("")} />
                </PaginaReveal>
              ) : (
                <PaginaReveal key="empty">
                  <NoProjecten onAction={() => router.push("/offertes?status=geaccepteerd")} />
                </PaginaReveal>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </PaginaReveal>
    </>
  );
}
