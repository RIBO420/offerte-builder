"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { RequireRole } from "@/components/require-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Search,
  Pencil,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Euro,
  TrendingUp,
  FileStack,
  Wrench,
  FileX,
  MinusCircle,
  Bell,
  AlertTriangle,
  Home,
} from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { FacturenPageSkeleton, Skeleton } from "@/components/ui/skeleton-card";
import {
  ExportDropdown,
  facturenExportColumns,
} from "@/components/export-dropdown";
import { formatCurrency } from "@/lib/format/currency";

// Status configuration for facturen - WCAG AA compliant colors (4.5:1 contrast ratio)
const statusConfig = {
  concept: {
    label: "Concept",
    icon: Pencil,
    color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  definitief: {
    label: "Definitief",
    icon: FileText,
    color: "bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  verzonden: {
    label: "Verzonden",
    icon: Send,
    color: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  betaald: {
    label: "Betaald",
    icon: CheckCircle2,
    color: "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  vervallen: {
    label: "Vervallen",
    icon: AlertCircle,
    color: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

type FactuurStatus = keyof typeof statusConfig;

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

function StatusBadge({ status }: { status: FactuurStatus }) {
  const config = statusConfig[status] || statusConfig.concept;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.color}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export default function FacturenPage() {
  return (
    <RequireRole allowedRoles={["directie", "projectleider"]}>
      <Suspense fallback={<FacturenPageLoader />}>
        <FacturenPageContent />
      </Suspense>
    </RequireRole>
  );
}

function FacturenPageLoader() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard"><Home className="size-4" /></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Facturen</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <FacturenPageSkeleton />
      </div>
    </>
  );
}

function FacturenPageContent() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { user, isLoading: isUserLoading } = useCurrentUser();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState("alle");

  // Cursor-based pagination state
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previousItems, setPreviousItems] = useState<any[]>([]);

  // Use cursor-based paginated query with status filter
  const statusFilter = activeTab !== "alle" ? activeTab as "concept" | "definitief" | "verzonden" | "betaald" | "vervallen" : undefined;

  const paginatedData = useQuery(
    api.facturen.listPaginated,
    user?._id ? { limit: 25, cursor, status: statusFilter } : "skip"
  );

  // Use server-side search for better performance
  const searchResults = useQuery(
    api.facturen.search,
    user?._id && debouncedSearchQuery.trim() ? { searchTerm: debouncedSearchQuery } : "skip"
  );

  // Also fetch stats (non-paginated for counts)
  const facturen = useQuery(api.facturen.list, user?._id ? {} : "skip");

  // Overdue stats for herinnering badges (FAC-006)
  const overdueStats = useQuery(
    api.betalingsherinneringen.getOverdueStats,
    user?._id ? {} : "skip"
  );

  // Export query
  const exportData = useQuery(api.export.exportFacturen, user?._id ? {} : "skip");

  const isLoading = isUserLoading || paginatedData === undefined;

  // Calculate stats from facturen
  /* eslint-disable react-hooks/purity -- Date.now() needed for expiry check */
  const stats = useMemo(() => {
    if (!facturen) {
      return {
        totaal: 0,
        concept: 0,
        definitief: 0,
        verzonden: 0,
        betaald: 0,
        vervallen: 0,
        totaalOmzet: 0,
        openstaand: 0,
        verlopen: 0,
      };
    }

    const now = Date.now();
    const counts = {
      totaal: facturen.length,
      concept: 0,
      definitief: 0,
      verzonden: 0,
      betaald: 0,
      vervallen: 0,
      totaalOmzet: 0,
      openstaand: 0,
      verlopen: 0,
    };

    facturen.forEach((factuur) => {
      counts[factuur.status as FactuurStatus]++;

      // Total revenue from paid invoices (creditnota's have negative amounts, so they reduce revenue)
      if (factuur.status === "betaald") {
        counts.totaalOmzet += factuur.totaalInclBtw;
      }

      // Creditnota's that are definitief also reduce revenue
      if (factuur.isCreditnota && factuur.status === "definitief") {
        counts.totaalOmzet += factuur.totaalInclBtw; // negative amount
      }

      // Outstanding amount (verzonden + vervallen), creditnota's excluded
      if ((factuur.status === "verzonden" || factuur.status === "vervallen") && !factuur.isCreditnota) {
        counts.openstaand += factuur.totaalInclBtw;
      }

      // Count overdue invoices (verzonden/vervallen past due date)
      if (
        (factuur.status === "verzonden" || factuur.status === "vervallen") &&
        now > factuur.vervaldatum &&
        !factuur.isCreditnota
      ) {
        counts.verlopen++;
      }
    });

    return counts;
  }, [facturen]);
  /* eslint-enable react-hooks/purity */

  // Accumulate items across cursor pages
  const allItems = useMemo(() => {
    if (!paginatedData) return previousItems;
    if (!cursor) return paginatedData.items;
    return [...previousItems, ...paginatedData.items];
  }, [paginatedData, cursor, previousItems]);

  // Get items to display - use search results when searching, otherwise use paginated data
  const displayedFacturen = useMemo(() => {
    // Use search results if we have a search query (search is not paginated)
    if (debouncedSearchQuery.trim() && searchResults) {
      // Filter by status tab for search results
      return searchResults.filter((factuur) => {
        return activeTab === "alle" || factuur.status === activeTab;
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

  // Reset cursor when changing tabs (status filter changes)
  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    setCursor(undefined);
    setPreviousItems([]);
  }, []);

  const handleNavigate = useCallback(
    (projectId: string) => {
      router.push(`/projecten/${projectId}/factuur`);
    },
    [router]
  );

  // Check if vervaldatum is in the past (verzonden or vervallen status)
  const isOverdue = useCallback((vervaldatum: number, status: string) => {
    return (status === "verzonden" || status === "vervallen") && vervaldatum < Date.now();
  }, []);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard"><Home className="size-4" /></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Facturen</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <m.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        {/* Header */}
        <m.div
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
              Facturen
            </h1>
            <p className="text-muted-foreground">
              Overzicht van al je facturen en betalingen
            </p>
          </div>
          <ExportDropdown
            getData={() => exportData ?? []}
            columns={facturenExportColumns}
            filename="facturen"
            sheetName="Facturen"
            disabled={!exportData || exportData.length === 0}
          />
        </m.div>

        {/* Stats Summary */}
        <m.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.15,
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stats.totaal}</p>
                  <p className="text-xs text-muted-foreground">
                    Totaal facturen
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.totaalOmzet)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Totale omzet (betaald)
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(stats.openstaand)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Openstaand bedrag
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <Euro className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={stats.verlopen > 0 ? "border-red-200 dark:border-red-900" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-2xl font-bold ${stats.verlopen > 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                    {stats.verlopen}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verlopen facturen
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.verlopen > 0 ? "bg-red-100 dark:bg-red-950" : "bg-gray-100 dark:bg-gray-950"}`}>
                  <AlertTriangle className={`h-5 w-5 ${stats.verlopen > 0 ? "text-red-600 dark:text-red-400" : "text-gray-400 dark:text-gray-600"}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </m.div>

        {/* Search */}
        <m.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.2,
          }}
        >
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoeken..."
              className="pl-8 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </m.div>

        {/* Facturen list */}
        <m.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reducedMotion ? 0 : 0.4,
            delay: reducedMotion ? 0 : 0.25,
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
                  {stats.totaal}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="concept">
                Concept
                {stats.concept > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.concept}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="definitief">
                Definitief
                {stats.definitief > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.definitief}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="verzonden">
                Verzonden
                {stats.verzonden > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.verzonden}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="betaald">
                Betaald
                {stats.betaald > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.betaald}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="vervallen">
                Vervallen
                {stats.vervallen > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {stats.vervallen}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-6">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <m.div
                    key="loading"
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reducedMotion ? undefined : { opacity: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.2 }}
                  >
                    <Card className="overflow-hidden">
                      {/* Table header skeleton */}
                      <div className="border-b px-4 py-3">
                        <div className="flex gap-4">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      </div>
                      {/* Table rows skeleton */}
                      <div className="divide-y">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-4 px-4 py-4">
                            <div className="flex items-center gap-3 flex-1">
                              <Skeleton className="h-8 w-8 rounded-lg" />
                              <Skeleton className="h-4 w-24" />
                            </div>
                            <div className="flex-1">
                              <Skeleton className="h-4 w-28 mb-1" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                          </div>
                        ))}
                      </div>
                    </Card>
                  </m.div>
                ) : displayedFacturen.length > 0 ? (
                  <m.div
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
                              <TableHead>Factuurnummer</TableHead>
                              <TableHead>Klant</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Bedrag</TableHead>
                              <TableHead>Factuurdatum</TableHead>
                              <TableHead>Vervaldatum</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {displayedFacturen.map((factuur) => {
                              const isMeerwerk = factuur.factuurType === "meerwerk";
                              const isDeelfactuur = !!factuur.isDeelfactuur;
                              const isCreditnota = !!factuur.isCreditnota;
                              return (
                              <TableRow
                                key={factuur._id}
                                className={`cursor-pointer hover:bg-muted/50 ${isCreditnota ? "bg-red-50/50 dark:bg-red-950/20" : ""}`}
                                onClick={() => handleNavigate(factuur.projectId)}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                      isCreditnota
                                        ? "bg-red-100 dark:bg-red-950"
                                        : isMeerwerk
                                          ? "bg-orange-100 dark:bg-orange-950"
                                          : isDeelfactuur
                                            ? "bg-purple-100 dark:bg-purple-950"
                                            : "bg-primary/10"
                                    }`}>
                                      {isCreditnota ? (
                                        <FileX className="h-4 w-4 text-red-600 dark:text-red-400" />
                                      ) : isMeerwerk ? (
                                        <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                      ) : isDeelfactuur ? (
                                        <FileStack className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                      ) : (
                                        <FileText className="h-4 w-4 text-primary" />
                                      )}
                                    </div>
                                    <div>
                                      <p className={`font-medium ${isCreditnota ? "text-red-700 dark:text-red-400" : ""}`}>
                                        {factuur.factuurnummer}
                                      </p>
                                      {isCreditnota && factuur.creditnotaReden && (
                                        <p className="text-xs text-red-500 dark:text-red-400 truncate max-w-[200px]" title={factuur.creditnotaReden}>
                                          {factuur.creditnotaReden}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{factuur.klant.naam}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {factuur.klant.plaats}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {isCreditnota ? (
                                    <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-200 dark:border-red-800">
                                      <MinusCircle className="h-3 w-3 mr-1" />
                                      Creditnota
                                    </Badge>
                                  ) : isMeerwerk ? (
                                    <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border-orange-200 dark:border-orange-800">
                                      Meerwerk
                                    </Badge>
                                  ) : isDeelfactuur ? (
                                    <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 border-purple-200 dark:border-purple-800">
                                      Deel {factuur.deelfactuurNummer} ({factuur.deelfactuurPercentage}%)
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Volledig</span>
                                  )}
                                </TableCell>
                                <TableCell className={`font-medium ${isCreditnota ? "text-red-600 dark:text-red-400" : ""}`}>
                                  {formatCurrency(factuur.totaalInclBtw)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(factuur.factuurdatum)}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const factuurOverdue = isOverdue(factuur.vervaldatum, factuur.status);
                                    const overdueInfo = overdueStats?.[factuur._id];
                                    return (
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className={factuurOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}>
                                            {formatDate(factuur.vervaldatum)}
                                          </span>
                                          {factuurOverdue && (
                                            <AlertTriangle className="h-4 w-4 text-red-500" />
                                          )}
                                        </div>
                                        {factuurOverdue && overdueInfo && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                              {overdueInfo.dagenVervallen}d verlopen
                                            </span>
                                            {overdueInfo.aantalHerinneringen > 0 && (
                                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                                                <Bell className="h-2.5 w-2.5 mr-0.5" />
                                                {overdueInfo.aantalHerinneringen}
                                              </Badge>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <StatusBadge
                                    status={factuur.status as FactuurStatus}
                                  />
                                </TableCell>
                              </TableRow>
                              );
                            })}
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
                  </m.div>
                ) : (
                  <m.div
                    key="empty"
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={
                      reducedMotion ? undefined : { opacity: 0, scale: 0.95 }
                    }
                    transition={{ duration: reducedMotion ? 0 : 0.3 }}
                  >
                    <Card>
                      <CardContent className="py-8">
                        <EmptyState
                          icon={<FileText />}
                          title={
                            searchQuery
                              ? "Geen facturen gevonden"
                              : "Nog geen facturen"
                          }
                          description={
                            searchQuery
                              ? "Probeer een andere zoekopdracht"
                              : "Facturen worden automatisch aangemaakt vanuit projecten na de nacalculatie. Start een project om facturen te genereren."
                          }
                          action={
                            !searchQuery
                              ? {
                                  label: "Bekijk Projecten",
                                  onClick: () => router.push("/projecten"),
                                }
                              : {
                                  label: "Zoekopdracht wissen",
                                  onClick: () => setSearchQuery(""),
                                  variant: "outline",
                                }
                          }
                        />
                      </CardContent>
                    </Card>
                  </m.div>
                )}
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </m.div>
      </m.div>
    </>
  );
}
