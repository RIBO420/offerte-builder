"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { Card } from "@/components/ui/card";
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
  Shovel,
  Trees,
  Search,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  Eye,
  Download,
  X,
  FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTable } from "@/components/ui/responsive-table";
import { NoOffertes, NoSearchResults } from "@/components/empty-states";
import { useOffertes } from "@/hooks/use-offertes";
import { useInstellingen } from "@/hooks/use-instellingen";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import {
  OfferteFiltersComponent,
  ActiveFilters,
  defaultFilters,
  type OfferteFilters,
} from "@/components/offerte/filters";
import { StatusBadge } from "@/components/ui/status-badge";
import { OffertesTableSkeleton } from "@/components/skeletons";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

export default function OffertesPage() {
  return (
    <Suspense fallback={<OffertesPageSkeleton />}>
      <OffertesPageContent />
    </Suspense>
  );
}

function OffertesPageSkeleton() {
  const reducedMotion = useReducedMotion();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Offertes</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.4, ease: "easeOut" }}
        className="flex flex-1 items-center justify-center"
      >
        <div className="relative flex flex-col items-center gap-4">
          {/* Gradient background glow */}
          <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-emerald-100/60 via-green-100/40 to-teal-100/60 dark:from-emerald-900/30 dark:via-green-900/20 dark:to-teal-900/30 blur-2xl" />

          {/* Pulsing glow effect behind icon */}
          <motion.div
            animate={reducedMotion ? {} : {
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 2,
              repeat: reducedMotion ? 0 : Infinity,
              ease: "easeInOut"
            }}
            className="absolute h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400/40 to-green-400/40 dark:from-emerald-500/30 dark:to-green-500/30 blur-xl"
          />

          {/* Icon container with scale animation */}
          <motion.div
            initial={reducedMotion ? false : { scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : 0.1 }}
            className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 border border-emerald-100 dark:border-emerald-800/50 shadow-lg shadow-emerald-500/10"
          >
            <motion.div
              animate={reducedMotion ? {} : { rotate: 360 }}
              transition={{ duration: 1.5, repeat: reducedMotion ? 0 : Infinity, ease: "linear" }}
            >
              <Loader2 className={`h-8 w-8 text-emerald-600 dark:text-emerald-400 ${reducedMotion ? "animate-spin" : ""}`} />
            </motion.div>
          </motion.div>

          {/* Loading text with fade */}
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : 0.2 }}
            className="relative text-center"
          >
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Offertes laden...</p>
            <p className="text-xs text-muted-foreground mt-1">Even geduld alstublieft</p>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

function OffertesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const { isLoading: isUserLoading } = useCurrentUser();
  const {
    offertes,
    stats,
    isLoading: isOffertesLoading,
    delete: deleteOfferte,
    duplicate,
    bulkUpdateStatus,
    bulkRemove,
  } = useOffertes();
  const { getNextNummer } = useInstellingen();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState(searchParams.get("status") || "alle");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<Id<"offertes">>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>("");

  // Initialize filters from URL params
  const [filters, setFilters] = useState<OfferteFilters>(() => ({
    type: (searchParams.get("type") as OfferteFilters["type"]) || "alle",
    dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
    dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
    amountMin: searchParams.get("amountMin") || "",
    amountMax: searchParams.get("amountMax") || "",
  }));

  const isLoading = isUserLoading || isOffertesLoading;

  // Update URL when filters change
  const updateUrlParams = (newFilters: OfferteFilters, newStatus: string) => {
    const params = new URLSearchParams();
    if (newStatus !== "alle") params.set("status", newStatus);
    if (newFilters.type !== "alle") params.set("type", newFilters.type);
    if (newFilters.dateFrom) params.set("dateFrom", newFilters.dateFrom.toISOString());
    if (newFilters.dateTo) params.set("dateTo", newFilters.dateTo.toISOString());
    if (newFilters.amountMin) params.set("amountMin", newFilters.amountMin);
    if (newFilters.amountMax) params.set("amountMax", newFilters.amountMax);

    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : "/offertes", { scroll: false });
  };

  const handleFiltersChange = (newFilters: OfferteFilters) => {
    setFilters(newFilters);
    updateUrlParams(newFilters, activeTab);
  };

  const handleFiltersReset = () => {
    setFilters(defaultFilters);
    updateUrlParams(defaultFilters, activeTab);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    updateUrlParams(filters, tab);
  };

  const filteredOffertes = useMemo(() => {
    return offertes?.filter((offerte) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        offerte.klant.naam.toLowerCase().includes(searchQuery.toLowerCase()) ||
        offerte.offerteNummer.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter (from tabs)
      const matchesStatus =
        activeTab === "alle" || offerte.status === activeTab;

      // Type filter
      const matchesType =
        filters.type === "alle" || offerte.type === filters.type;

      // Date range filter
      const offerteDate = new Date(offerte.updatedAt);
      const matchesDateFrom =
        !filters.dateFrom || offerteDate >= filters.dateFrom;
      const matchesDateTo =
        !filters.dateTo || offerteDate <= new Date(filters.dateTo.getTime() + 86400000); // Include end date

      // Amount range filter
      const amount = offerte.totalen.totaalInclBtw;
      const matchesAmountMin =
        !filters.amountMin || amount >= parseFloat(filters.amountMin);
      const matchesAmountMax =
        !filters.amountMax || amount <= parseFloat(filters.amountMax);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesAmountMin &&
        matchesAmountMax
      );
    });
  }, [offertes, searchQuery, activeTab, filters]);

  const handleDuplicate = async (offerteId: string) => {
    try {
      const newNummer = await getNextNummer();
      await duplicate({ id: offerteId as Id<"offertes">, newOfferteNummer: newNummer });
      toast.success("Offerte gedupliceerd");
    } catch {
      toast.error("Fout bij dupliceren offerte");
    }
  };

  const handleDelete = async (offerteId: string) => {
    if (!confirm("Weet je zeker dat je deze offerte wilt verwijderen?")) return;
    try {
      await deleteOfferte({ id: offerteId as Id<"offertes"> });
      toast.success("Offerte verwijderd");
    } catch {
      toast.error("Fout bij verwijderen offerte");
    }
  };

  // Bulk action handlers
  const toggleSelectAll = () => {
    if (!filteredOffertes) return;
    if (selectedIds.size === filteredOffertes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOffertes.map((o) => o._id)));
    }
  };

  const toggleSelect = (id: Id<"offertes">) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkStatusValue("");
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdateStatus({
        ids: Array.from(selectedIds),
        status: status as "concept" | "definitief" | "verzonden" | "geaccepteerd" | "afgewezen",
      });
      toast.success(`${selectedIds.size} offerte(s) bijgewerkt naar ${status}`);
      clearSelection();
    } catch {
      toast.error("Fout bij bijwerken status");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await bulkRemove({ ids: Array.from(selectedIds) });
      toast.success(`${selectedIds.size} offerte(s) verwijderd`);
      clearSelection();
      setShowBulkDeleteDialog(false);
    } catch {
      toast.error("Fout bij verwijderen offertes");
    }
  };

  const handleExportCSV = () => {
    if (!filteredOffertes) return;
    const exportData = selectedIds.size > 0
      ? filteredOffertes.filter((o) => selectedIds.has(o._id))
      : filteredOffertes;

    const headers = ["Nummer", "Type", "Klant", "Adres", "Plaats", "Status", "Bedrag (incl. BTW)", "Datum"];
    const rows = exportData.map((o) => [
      o.offerteNummer,
      o.type,
      o.klant.naam,
      o.klant.adres,
      o.klant.plaats,
      o.status,
      o.totalen.totaalInclBtw.toFixed(2),
      new Date(o.updatedAt).toLocaleDateString("nl-NL"),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `offertes-export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success(`${exportData.length} offerte(s) geexporteerd`);
  };

  const isAllSelected = filteredOffertes && filteredOffertes.length > 0 && selectedIds.size === filteredOffertes.length;
  const isSomeSelected = selectedIds.size > 0;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Offertes</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : 0.1 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Offertes
            </h1>
            <p className="text-muted-foreground">
              Beheer al je aanleg- en onderhoudsoffertes
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/offertes/nieuw/onderhoud">
                <Trees className="mr-2 h-4 w-4" />
                Onderhoud
              </Link>
            </Button>
            <Button asChild>
              <Link href="/offertes/nieuw/aanleg">
                <Shovel className="mr-2 h-4 w-4" />
                Aanleg
              </Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : 0.2 }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op klantnaam of offertenummer..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <OfferteFiltersComponent
              filters={filters}
              onChange={handleFiltersChange}
              onReset={handleFiltersReset}
            />
          </div>
          <ActiveFilters filters={filters} onChange={handleFiltersChange} />
        </motion.div>

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : 0.3 }}
        >
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="alle">
              Alle
              <Badge variant="secondary" className="ml-2">
                {stats?.totaal || 0}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="concept">
              Concept
              {(stats?.concept || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.concept}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="verzonden">
              Verzonden
              {(stats?.verzonden || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.verzonden}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="geaccepteerd">
              Geaccepteerd
              {(stats?.geaccepteerd || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.geaccepteerd}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="afgewezen">
              Afgewezen
              {(stats?.afgewezen || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.afgewezen}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6">
            {/* Bulk Actions Bar */}
            {isSomeSelected && (
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {selectedIds.size} geselecteerd
                  </span>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <Select
                    value={bulkStatusValue}
                    onValueChange={(value) => {
                      setBulkStatusValue(value);
                      handleBulkStatusChange(value);
                    }}
                  >
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Wijzig status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concept">Concept</SelectItem>
                      <SelectItem value="definitief">Definitief</SelectItem>
                      <SelectItem value="verzonden">Verzonden</SelectItem>
                      <SelectItem value="geaccepteerd">Geaccepteerd</SelectItem>
                      <SelectItem value="afgewezen">Afgewezen</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exporteer
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowBulkDeleteDialog(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Verwijderen
                  </Button>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: reducedMotion ? 0 : 0.3 }}
                >
                  <OffertesTableSkeleton rows={8} />
                </motion.div>
              ) : filteredOffertes && filteredOffertes.length > 0 ? (
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
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={isAllSelected}
                              onCheckedChange={toggleSelectAll}
                              aria-label="Selecteer alle"
                            />
                          </TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Nummer</TableHead>
                          <TableHead>Klant</TableHead>
                          <TableHead>Plaats</TableHead>
                          <TableHead>Bedrag</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOffertes.map((offerte, index) => (
                          <motion.tr
                            key={offerte._id}
                            initial={reducedMotion ? false : { opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: reducedMotion ? 0 : 0.3,
                              delay: reducedMotion ? 0 : index * 0.05,
                            }}
                            className={`border-b hover:bg-muted/50 transition-colors cursor-pointer hover:translate-y-[-1px] ${selectedIds.has(offerte._id) ? "bg-muted/50" : ""}`}
                            onClick={(e) => {
                              // Alleen navigeren als niet op checkbox of dropdown geklikt
                              const target = e.target as HTMLElement;
                              if (!target.closest('button') && !target.closest('[role="checkbox"]')) {
                                router.push(`/offertes/${offerte._id}`);
                              }
                            }}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(offerte._id)}
                                onCheckedChange={() => toggleSelect(offerte._id)}
                                aria-label={`Selecteer ${offerte.offerteNummer}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                  offerte.type === "aanleg"
                                    ? "bg-primary/10"
                                    : "bg-green-100"
                                }`}
                              >
                                {offerte.type === "aanleg" ? (
                                  <Shovel className="h-4 w-4 text-primary" />
                                ) : (
                                  <Trees className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              <Link
                                href={`/offertes/${offerte._id}`}
                                className="hover:underline"
                              >
                                {offerte.offerteNummer}
                              </Link>
                            </TableCell>
                            <TableCell>{offerte.klant.naam}</TableCell>
                            <TableCell>{offerte.klant.plaats}</TableCell>
                            <TableCell>
                              {formatCurrency(offerte.totalen.totaalInclBtw)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={offerte.status} size="sm" />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(offerte.updatedAt)}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/offertes/${offerte._id}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Bekijken
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDuplicate(offerte._id)}
                                  >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Dupliceren
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(offerte._id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Verwijderen
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                    </ScrollableTable>
                  </Card>
                </motion.div>
              ) : searchQuery ? (
                <motion.div
                  key="no-results"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
                  transition={{ duration: reducedMotion ? 0 : 0.3 }}
                >
                  <NoSearchResults onAction={() => setSearchQuery("")} />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
                  transition={{ duration: reducedMotion ? 0 : 0.3 }}
                >
                  <NoOffertes onAction={() => router.push("/offertes/nieuw/aanleg")} />
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
        </motion.div>
      </motion.div>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Offertes verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {selectedIds.size} offerte(s) wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
