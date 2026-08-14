"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { RequireRole } from "@/components/require-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Search,
  Send,
  Euro,
  TrendingUp,
  FileStack,
  Wrench,
  FileX,
  MinusCircle,
  Bell,
  AlertTriangle,
  FilePlus2,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsKantoor } from "@/hooks/use-users";
import { EmptyState } from "@/components/ui/empty-state";
import { FacturenPageSkeleton, Skeleton } from "@/components/ui/skeleton-card";
import {
  ExportDropdown,
  facturenExportColumns,
} from "@/components/export-dropdown";
import { formatCurrency } from "@/lib/format/currency";
import { OpenstaandOverzicht } from "@/components/facturen/openstaand-overzicht";
import {
  FACTUUR_STATUS_CONFIG,
  statusClasses,
  type FactuurStatus,
} from "@/lib/constants/statuses";

// Statuskleuren uit de centrale bron (WS4): zelfde status = zelfde kleur.
const statusConfig = FACTUUR_STATUS_CONFIG;

/**
 * Weergavestatus op basis van de gesplitste statussen (§2.8):
 * documentketen tot en met "verzonden", daarna wint de betaalketen.
 * Valt terug op het legacy status-veld voor ongemigreerde rijen.
 */
function weergaveStatus(factuur: {
  status: string;
  documentStatus?: "concept" | "definitief" | "verzonden";
  betaalStatus?:
    | "open"
    | "gedeeltelijk_betaald"
    | "betaald"
    | "vervallen"
    | "geannuleerd";
}): FactuurStatus {
  const doc = factuur.documentStatus;
  const betaal = factuur.betaalStatus;
  if (!doc || !betaal) return factuur.status as FactuurStatus;
  if (doc !== "verzonden") return doc;
  switch (betaal) {
    case "betaald":
      return "betaald";
    case "gedeeltelijk_betaald":
      return "gedeeltelijk_betaald";
    case "vervallen":
    case "geannuleerd":
      return "vervallen";
    default:
      return "verzonden";
  }
}

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
    <Badge variant="outline" className={statusClasses(config)}>
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
      <PageHeader />
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

  // "Te versturen"-wachtrij (§2.8): bulk-selectie + verstuur
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [isVersturen, setIsVersturen] = useState(false);
  const bulkVerstuur = useMutation(api.facturen.bulkVerstuur);

  // Cursor-based pagination state
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previousItems, setPreviousItems] = useState<any[]>([]);

  // Use cursor-based paginated query with status filter
  // ("openstaand" is het debiteurenoverzicht (§3.2) met een eigen query)
  const statusFilter = activeTab !== "alle" && activeTab !== "openstaand" ? activeTab as "concept" | "definitief" | "verzonden" | "betaald" | "vervallen" : undefined;

  const paginatedData = useQuery(
    api.facturen.listPaginated,
    user?._id ? { limit: 25, cursor, status: statusFilter } : "skip"
  );

  // Use server-side search for better performance
  const searchResults = useQuery(
    api.facturen.search,
    user?._id && debouncedSearchQuery.trim() ? { searchTerm: debouncedSearchQuery } : "skip"
  );

  // Compacte tellers (server-side, i.p.v. de volledige facturenlijst laden)
  const lijstStats = useQuery(api.facturen.getLijstStats, user?._id ? {} : "skip");

  // Overdue stats for herinnering badges (FAC-006)
  const overdueStats = useQuery(
    api.betalingsherinneringen.getOverdueStats,
    user?._id ? {} : "skip"
  );

  // Export is kantoor-functionaliteit (PRD §1.2) en wordt pas on-demand
  // opgehaald bij een klik op de exportknop (geen reactieve query die de
  // volledige export-payload open houdt zolang de pagina open staat).
  const isKantoor = useIsKantoor();
  const convex = useConvex();

  const isLoading = isUserLoading || paginatedData === undefined;

  // Stats komen als negen tellers van de server (facturen.getLijstStats)
  const stats = lijstStats ?? {
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
    setGeselecteerd(new Set());
  }, []);

  const handleNavigate = useCallback(
    (projectId: string | undefined) => {
      // Losse facturen (§2.8) hebben geen project(pagina)
      if (projectId) router.push(`/projecten/${projectId}/factuur`);
    },
    [router]
  );

  // Wachtrij-modus: op de "Te versturen"-tab is bulk-selectie actief (§2.8)
  const isWachtrijTab = activeTab === "concept";

  const toggleSelectie = useCallback((id: string) => {
    setGeselecteerd((huidig) => {
      const volgende = new Set(huidig);
      if (volgende.has(id)) {
        volgende.delete(id);
      } else {
        volgende.add(id);
      }
      return volgende;
    });
  }, []);

  const handleBulkVerstuur = useCallback(async () => {
    if (geselecteerd.size === 0 || isVersturen) return;
    setIsVersturen(true);
    try {
      const resultaat = await bulkVerstuur({
        ids: [...geselecteerd] as Id<"facturen">[],
      });
      toast.success(
        `${resultaat.verstuurd} ${resultaat.verstuurd === 1 ? "factuur" : "facturen"} verstuurd` +
          (resultaat.overgeslagen.length > 0
            ? ` (${resultaat.overgeslagen.length} overgeslagen)`
            : "")
      );
      setGeselecteerd(new Set());
    } catch {
      toast.error("Versturen mislukt — controleer de facturen en probeer opnieuw");
    } finally {
      setIsVersturen(false);
    }
  }, [geselecteerd, isVersturen, bulkVerstuur]);

  // Check if vervaldatum is in the past (verzonden or vervallen status)
  const isOverdue = useCallback((vervaldatum: number, status: string) => {
    return (status === "verzonden" || status === "vervallen") && vervaldatum < Date.now();
  }, []);

  return (
    <>
      <PageHeader />

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
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Facturen
            </h1>
            <p className="text-muted-foreground">
              Overzicht van al je facturen en betalingen
            </p>
          </div>
          {/* flex-wrap: op 375px liep deze knoppenrij 36px buiten beeld
              (CLAUDE.md regel 1: nooit zijwaarts scrollen). */}
          <div className="flex flex-wrap items-center gap-2">
            {isKantoor && (
              <Button onClick={() => router.push("/facturen/nieuw")}>
                <FilePlus2 className="h-4 w-4 mr-2" />
                Nieuwe factuur
              </Button>
            )}
            {isKantoor && (
              <ExportDropdown
                getData={() => convex.query(api.export.exportFacturen, {})}
                columns={facturenExportColumns}
                filename="facturen"
                sheetName="Facturen"
              />
            )}
          </div>
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
                <div className="h-10 w-10 rounded-full bg-status-gepland flex items-center justify-center">
                  <FileText className="h-5 w-5 text-status-gepland-text" />
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
                <div className="h-10 w-10 rounded-full bg-status-betaald flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-status-betaald-text" />
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
                <div className="h-10 w-10 rounded-full bg-status-herinnering flex items-center justify-center">
                  <Euro className="h-5 w-5 text-status-herinnering-text" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={stats.verlopen > 0 ? "border-status-vervallen-border" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-2xl font-bold ${stats.verlopen > 0 ? "text-destructive" : ""}`}>
                    {stats.verlopen}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Verlopen facturen
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stats.verlopen > 0 ? "bg-status-vervallen" : "bg-muted"}`}>
                  <AlertTriangle className={`h-5 w-5 ${stats.verlopen > 0 ? "text-status-vervallen-text" : "text-muted-foreground"}`} />
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
              aria-label="Zoek facturen"
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
            {/* flex-wrap i.p.v. overflow-x-auto: de app scrolt nergens zijwaarts
                (CLAUDE.md regel 1); op smalle schermen wrappen de 7 tabs. */}
            <TabsList className="flex-wrap justify-start overflow-x-visible group-data-[orientation=horizontal]/tabs:h-auto group-data-[orientation=horizontal]/tabs:sm:h-auto">
              <TabsTrigger value="alle">
                Alle
                <Badge variant="secondary" className="ml-2">
                  {stats.totaal}
                </Badge>
              </TabsTrigger>
              {/* §2.8: concepten (uit de engine, projecten of losse facturen)
                  zijn de "Te versturen"-wachtrij — kantoor checkt en verstuurt */}
              <TabsTrigger value="concept">
                Te versturen
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
              {/* §3.2: de lijst ís het debiteurenoverzicht — "verschuldigd
                  sinds", aanmaanniveau en pauzeer-acties per factuur */}
              <TabsTrigger value="openstaand">
                <Bell className="mr-1 h-4 w-4" />
                Openstaand
              </TabsTrigger>
            </TabsList>

            {activeTab === "openstaand" ? (
              <TabsContent value="openstaand" className="space-y-6">
                <OpenstaandOverzicht isKantoor={isKantoor} />
              </TabsContent>
            ) : (
            <TabsContent value={activeTab} className="space-y-6">
              {/* Bulk-verstuur vanuit de wachtrij (§2.8) — alleen kantoor */}
              {isWachtrijTab && isKantoor && displayedFacturen.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                  <Checkbox
                    id="selecteer-alles"
                    checked={
                      geselecteerd.size > 0 &&
                      geselecteerd.size === displayedFacturen.length
                    }
                    onCheckedChange={(checked) =>
                      setGeselecteerd(
                        checked
                          ? new Set(displayedFacturen.map((f) => f._id as string))
                          : new Set()
                      )
                    }
                  />
                  <label
                    htmlFor="selecteer-alles"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Alles selecteren
                  </label>
                  <Button
                    size="sm"
                    onClick={handleBulkVerstuur}
                    disabled={geselecteerd.size === 0 || isVersturen}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isVersturen
                      ? "Bezig met versturen…"
                      : `Verstuur geselecteerde (${geselecteerd.size})`}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Laatste check vóór verzending — de klant ontvangt de factuur
                    per e-mail.
                  </p>
                </div>
              )}
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
                              {isWachtrijTab && isKantoor && (
                                <TableHead className="w-10" aria-label="Selecteer" />
                              )}
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
                                className={`${factuur.projectId ? "cursor-pointer" : ""} hover:bg-muted/50 ${isCreditnota ? "bg-destructive/5" : ""}`}
                                onClick={() => handleNavigate(factuur.projectId)}
                              >
                                {isWachtrijTab && isKantoor && (
                                  <TableCell
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-10"
                                  >
                                    <Checkbox
                                      aria-label={`Selecteer ${factuur.factuurnummer}`}
                                      checked={geselecteerd.has(factuur._id)}
                                      onCheckedChange={() =>
                                        toggleSelectie(factuur._id)
                                      }
                                    />
                                  </TableCell>
                                )}
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                      isCreditnota
                                        ? "bg-status-vervallen"
                                        : isMeerwerk
                                          ? "bg-status-in-uitvoering"
                                          : isDeelfactuur
                                            ? "bg-status-gepland"
                                            : "bg-primary/10"
                                    }`}>
                                      {isCreditnota ? (
                                        <FileX className="h-4 w-4 text-status-vervallen-text" />
                                      ) : isMeerwerk ? (
                                        <Wrench className="h-4 w-4 text-status-in-uitvoering-text" />
                                      ) : isDeelfactuur ? (
                                        <FileStack className="h-4 w-4 text-status-gepland-text" />
                                      ) : (
                                        <FileText className="h-4 w-4 text-primary" />
                                      )}
                                    </div>
                                    <div>
                                      <p className={`font-medium ${isCreditnota ? "text-destructive" : ""}`}>
                                        {factuur.factuurnummer}
                                      </p>
                                      {isCreditnota && factuur.creditnotaReden && (
                                        <p className="text-xs text-destructive truncate max-w-[200px]" title={factuur.creditnotaReden}>
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
                                    <Badge variant="outline" className="bg-status-vervallen text-status-vervallen-text border-status-vervallen-border">
                                      <MinusCircle className="h-3 w-3 mr-1" />
                                      Creditnota
                                    </Badge>
                                  ) : isMeerwerk ? (
                                    <Badge variant="outline" className="bg-status-in-uitvoering text-status-in-uitvoering-text border-status-in-uitvoering-border">
                                      Meerwerk
                                    </Badge>
                                  ) : isDeelfactuur ? (
                                    <Badge variant="outline" className="bg-status-gepland text-status-gepland-text border-status-gepland-border">
                                      Deel {factuur.deelfactuurNummer} ({factuur.deelfactuurPercentage}%)
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Volledig</span>
                                  )}
                                </TableCell>
                                <TableCell className={`font-medium ${isCreditnota ? "text-destructive" : ""}`}>
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
                                          <span className={factuurOverdue ? "text-destructive font-medium" : "text-muted-foreground"}>
                                            {formatDate(factuur.vervaldatum)}
                                          </span>
                                          {factuurOverdue && (
                                            <AlertTriangle className="h-4 w-4 text-destructive" />
                                          )}
                                        </div>
                                        {factuurOverdue && overdueInfo && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-destructive font-medium">
                                              {overdueInfo.dagenVervallen}d verlopen
                                            </span>
                                            {overdueInfo.aantalHerinneringen > 0 && (
                                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-status-herinnering text-status-herinnering-text border-status-herinnering-border">
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
                                  <StatusBadge status={weergaveStatus(factuur)} />
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
            )}
          </Tabs>
        </m.div>
      </m.div>
    </>
  );
}
