"use client";

import { useState, useMemo, useCallback, Suspense, memo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { useDebounce } from "@/hooks/use-debounce";
import { useTableSort } from "@/hooks/use-table-sort";
import { RequireAdmin } from "@/components/require-admin";
import { PageHeader } from "@/components/page-header";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Shovel,
  Trees,
  Search,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  Eye,
  ExternalLink,
  Download,
  X,
  FileText,
  FolderKanban,
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
import { showDeleteToast } from "@/lib/toast-utils";
import {
  OfferteFiltersComponent,
  ActiveFilters,
  defaultFilters,
  type OfferteFilters,
} from "@/components/offerte/filters";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterPresetSelector } from "@/components/ui/filter-preset-selector";
import {
  useFilterPresets,
  type OfferteFilterState,
} from "@/hooks/use-filter-presets";
import {
  ExportDropdown,
  offerteExportColumns,
} from "@/components/export-dropdown";

// Memoized formatter instances to avoid recreation
const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

// Project info type for offerte rows
type ProjectInfo = {
  _id: Id<"projecten">;
  naam: string;
  status: string;
} | null;

// Type for sortable offerte data
type SortableOfferte = {
  _id: Id<"offertes">;
  type: "aanleg" | "onderhoud";
  offerteNummer: string;
  klantNaam: string;
  klantPlaats: string;
  bedrag: number;
  status: string;
  datum: number;
  // Original offerte reference
  original: {
    _id: Id<"offertes">;
    type: "aanleg" | "onderhoud";
    offerteNummer: string;
    klant: { naam: string; adres: string; plaats: string };
    totalen: { totaalInclBtw: number };
    status: string;
    updatedAt: number;
  };
};

// Memoized table row component to prevent unnecessary re-renders
interface OfferteRowProps {
  offerte: {
    _id: Id<"offertes">;
    type: "aanleg" | "onderhoud";
    offerteNummer: string;
    klant: { naam: string; plaats: string };
    totalen: { totaalInclBtw: number };
    status: string;
    updatedAt: number;
  };
  projectInfo: ProjectInfo;
  isSelected: boolean;
  onToggleSelect: (id: Id<"offertes">) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (id: string) => void;
  reducedMotion: boolean;
  index: number;
}

const OfferteRow = memo(function OfferteRow({
  offerte,
  projectInfo,
  isSelected,
  onToggleSelect,
  onDuplicate,
  onDelete,
  onNavigate,
  reducedMotion,
  index,
}: OfferteRowProps) {
  const hasProject = projectInfo !== null;
  const handleRowClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('button') && !target.closest('[role="checkbox"]')) {
      onNavigate(offerte._id);
    }
  }, [offerte._id, onNavigate]);

  const handleToggleSelect = useCallback(() => {
    onToggleSelect(offerte._id);
  }, [offerte._id, onToggleSelect]);

  const handleDuplicate = useCallback(() => {
    onDuplicate(offerte._id);
  }, [offerte._id, onDuplicate]);

  const handleDelete = useCallback(() => {
    onDelete(offerte._id);
  }, [offerte._id, onDelete]);

  return (
    <motion.tr
      key={offerte._id}
      initial={reducedMotion ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.3,
        delay: reducedMotion ? 0 : index * 0.05,
      }}
      className={`border-b hover:bg-muted/50 transition-colors cursor-pointer hover:translate-y-[-1px] ${isSelected ? "bg-muted/50" : ""}`}
      onClick={handleRowClick}
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleToggleSelect}
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
        <div className="flex items-center gap-2">
          <StatusBadge status={offerte.status} size="sm" />
          {/* Project indicator icon with tooltip */}
          {hasProject && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/projecten/${projectInfo._id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <FolderKanban className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>{projectInfo.naam}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {/* Project button: "Bekijk Project" if exists, "Start Project" if geaccepteerd without project */}
          {hasProject ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/projecten/${projectInfo._id}`}>
                <ExternalLink className="h-3 w-3 mr-1" />
                Bekijk Project
              </Link>
            </Button>
          ) : offerte.status === "geaccepteerd" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/projecten/nieuw?offerte=${offerte._id}`}>
                <FolderKanban className="h-3 w-3 mr-1" />
                Start Project
              </Link>
            </Button>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(offerte.updatedAt)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" aria-label="Meer opties">
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
            {hasProject ? (
              <DropdownMenuItem asChild>
                <Link href={`/projecten/${projectInfo._id}`} className="text-blue-600">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Bekijk Project
                </Link>
              </DropdownMenuItem>
            ) : offerte.status === "geaccepteerd" ? (
              <DropdownMenuItem asChild>
                <Link href={`/projecten/nieuw?offerte=${offerte._id}`} className="text-green-600">
                  <FolderKanban className="mr-2 h-4 w-4" />
                  Start Project
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Dupliceren
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Verwijderen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </motion.tr>
  );
});

export default function OffertesPage() {
  return (
    <RequireAdmin>
      <Suspense fallback={<OffertesPageLoader />}>
        <OffertesPageContent />
      </Suspense>
    </RequireAdmin>
  );
}

function OffertesPageLoader() {
  return (
    <>
      <PageHeader />
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
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
    restore: restoreOfferte,
    duplicate,
    bulkUpdateStatus,
    bulkRemove,
    bulkRestore,
  } = useOffertes();
  const { getNextNummer } = useInstellingen();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
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

  // Filter presets
  const {
    presets,
    defaultPresets,
    userPresets,
    addPreset,
    deletePreset,
  } = useFilterPresets<OfferteFilterState>("offertes");

  // Export data query
  const exportData = useQuery(api.export.exportOffertes);

  const isLoading = isUserLoading || isOffertesLoading;

  // Get offerte IDs for batch project lookup
  const offerteIds = useMemo(() => {
    return offertes?.map((o) => o._id) ?? [];
  }, [offertes]);

  // Fetch projects for all offertes in one efficient query
  const projectsByOfferte = useQuery(
    api.projecten.getProjectsByOfferteIds,
    offerteIds.length > 0 ? { offerteIds } : "skip"
  );

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

  const handleFiltersChange = useCallback((newFilters: OfferteFilters) => {
    setFilters(newFilters);
    updateUrlParams(newFilters, activeTab);
  }, [activeTab]);

  const handleFiltersReset = useCallback(() => {
    setFilters(defaultFilters);
    updateUrlParams(defaultFilters, activeTab);
  }, [activeTab]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    updateUrlParams(filters, tab);
  }, [filters]);

  // Handle preset selection - convert preset filters to OfferteFilters format
  const handlePresetSelect = useCallback((presetFilters: OfferteFilterState) => {
    // Convert preset status to tab if it matches a single status
    if (presetFilters.status) {
      const statuses = presetFilters.status.split(",");
      if (statuses.length === 1 && ["concept", "voorcalculatie", "verzonden", "geaccepteerd", "afgewezen"].includes(statuses[0])) {
        setActiveTab(statuses[0]);
      } else {
        // Multiple statuses - keep on "alle" tab
        setActiveTab("alle");
      }
    }

    // Convert preset filters to OfferteFilters format
    const newFilters: OfferteFilters = {
      type: presetFilters.type || "alle",
      dateFrom: presetFilters.dateFrom ? new Date(presetFilters.dateFrom) : undefined,
      dateTo: presetFilters.dateTo ? new Date(presetFilters.dateTo) : undefined,
      amountMin: presetFilters.amountMin || "",
      amountMax: presetFilters.amountMax || "",
    };
    setFilters(newFilters);
    updateUrlParams(newFilters, presetFilters.status?.split(",")[0] || activeTab);
  }, [activeTab]);

  // Convert current filters to preset format for saving
  const currentFiltersForPreset = useMemo((): OfferteFilterState => ({
    status: activeTab !== "alle" ? activeTab : undefined,
    type: filters.type,
    dateFrom: filters.dateFrom?.toISOString(),
    dateTo: filters.dateTo?.toISOString(),
    amountMin: filters.amountMin,
    amountMax: filters.amountMax,
  }), [activeTab, filters]);

  // Check if there are active filters
  const hasActiveFilters = useMemo(() => {
    return filters.type !== "alle" ||
      filters.dateFrom !== undefined ||
      filters.dateTo !== undefined ||
      filters.amountMin !== "" ||
      filters.amountMax !== "" ||
      activeTab !== "alle";
  }, [filters, activeTab]);

  // Handle saving preset
  const handleSavePreset = useCallback((name: string, presetFilters: OfferteFilterState) => {
    addPreset(name, presetFilters);
    toast.success(`Preset "${name}" opgeslagen`);
  }, [addPreset]);

  // Handle deleting preset
  const handleDeletePreset = useCallback((id: string) => {
    deletePreset(id);
    toast.success("Preset verwijderd");
  }, [deletePreset]);

  const filteredOffertes = useMemo(() => {
    return offertes?.filter((offerte) => {
      // Search filter (use debounced value for filtering)
      const matchesSearch =
        debouncedSearchQuery === "" ||
        offerte.klant.naam.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        offerte.offerteNummer.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

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
  }, [offertes, debouncedSearchQuery, activeTab, filters]);

  // Transform filtered offertes to sortable format
  const sortableOffertes = useMemo<SortableOfferte[]>(() => {
    return (filteredOffertes ?? []).map((offerte) => ({
      _id: offerte._id,
      type: offerte.type,
      offerteNummer: offerte.offerteNummer,
      klantNaam: offerte.klant.naam,
      klantPlaats: offerte.klant.plaats,
      bedrag: offerte.totalen.totaalInclBtw,
      status: offerte.status,
      datum: offerte.updatedAt,
      original: offerte,
    }));
  }, [filteredOffertes]);

  // Apply sorting to offertes
  const { sortedData: sortedOffertes, sortConfig, toggleSort } = useTableSort<SortableOfferte>(
    sortableOffertes,
    "datum"
  );

  const handleDuplicate = useCallback(async (offerteId: string) => {
    try {
      const newNummer = await getNextNummer();
      await duplicate({ id: offerteId as Id<"offertes">, newOfferteNummer: newNummer });
      toast.success("Offerte gedupliceerd");
    } catch {
      toast.error("Fout bij dupliceren offerte");
    }
  }, [getNextNummer, duplicate]);

  const handleDelete = useCallback(async (offerteId: string) => {
    try {
      const id = offerteId as Id<"offertes">;
      await deleteOfferte({ id });
      // Show undo toast with 30-second window
      showDeleteToast(
        "Offerte verwijderd",
        async () => {
          await restoreOfferte({ id });
        }
      );
    } catch {
      toast.error("Fout bij verwijderen offerte");
    }
  }, [deleteOfferte, restoreOfferte]);

  const handleNavigate = useCallback((offerteId: string) => {
    router.push(`/offertes/${offerteId}`);
  }, [router]);

  // Bulk action handlers - memoized with useCallback
  const toggleSelectAll = useCallback(() => {
    if (sortedOffertes.length === 0) return;
    if (selectedIds.size === sortedOffertes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedOffertes.map((o) => o._id)));
    }
  }, [sortedOffertes, selectedIds.size]);

  const toggleSelect = useCallback((id: Id<"offertes">) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkStatusValue("");
  }, []);

  const handleBulkStatusChange = useCallback(async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await bulkUpdateStatus({
        ids: Array.from(selectedIds),
        status: status as "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen",
      });
      toast.success(`${selectedIds.size} offerte(s) bijgewerkt naar ${status}`);
      clearSelection();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Fout bij bijwerken status";
      toast.error(errorMessage);
    }
  }, [selectedIds, bulkUpdateStatus, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const count = ids.length;
    try {
      await bulkRemove({ ids });
      clearSelection();
      setShowBulkDeleteDialog(false);
      // Show undo toast with 30-second window
      showDeleteToast(
        `${count} offerte(s) verwijderd`,
        async () => {
          await bulkRestore({ ids });
        }
      );
    } catch {
      toast.error("Fout bij verwijderen offertes");
    }
  }, [selectedIds, bulkRemove, bulkRestore, clearSelection]);

  const handleExportCSV = useCallback(() => {
    if (sortedOffertes.length === 0) return;
    const exportData = selectedIds.size > 0
      ? sortedOffertes.filter((o) => selectedIds.has(o._id))
      : sortedOffertes;

    const headers = ["Nummer", "Type", "Klant", "Adres", "Plaats", "Status", "Bedrag (incl. BTW)", "Datum"];
    const rows = exportData.map((o) => [
      o.offerteNummer,
      o.type,
      o.klantNaam,
      o.original.klant.adres,
      o.klantPlaats,
      o.status,
      o.bedrag.toFixed(2),
      new Date(o.datum).toLocaleDateString("nl-NL"),
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
  }, [sortedOffertes, selectedIds]);

  const isAllSelected = sortedOffertes.length > 0 && selectedIds.size === sortedOffertes.length;
  const isSomeSelected = selectedIds.size > 0;

  return (
    <>
      <PageHeader />

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
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Offertes
            </h1>
            <p className="text-muted-foreground">
              Beheer al je aanleg- en onderhoudsoffertes
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="outline" className="flex-1 sm:flex-none">
                  <Link href="/offertes/nieuw/onderhoud">
                    <Trees className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Onderhoud</span>
                    <span className="sm:hidden">Onderhoud Offerte</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Maak een nieuwe onderhoudsofferte</p>
                <p className="text-xs text-muted-foreground">Voor periodiek tuinonderhoud</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild className="flex-1 sm:flex-none">
                  <Link href="/offertes/nieuw/aanleg">
                    <Shovel className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Aanleg</span>
                    <span className="sm:hidden">Aanleg Offerte</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Maak een nieuwe aanlegofferte</p>
                <p className="text-xs text-muted-foreground">Voor tuinaanleg projecten</p>
              </TooltipContent>
            </Tooltip>
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
            <div className="flex items-center gap-2">
              <ExportDropdown
                getData={() => exportData ?? []}
                columns={offerteExportColumns}
                filename="offertes"
                sheetName="Offertes"
                disabled={!exportData || exportData.length === 0}
              />
              <FilterPresetSelector<OfferteFilterState>
                presets={presets}
                defaultPresets={defaultPresets}
                userPresets={userPresets}
                currentFilters={currentFiltersForPreset}
                onSelectPreset={handlePresetSelect}
                onSavePreset={handleSavePreset}
                onDeletePreset={handleDeletePreset}
                hasActiveFilters={hasActiveFilters}
              />
              <OfferteFiltersComponent
                filters={filters}
                onChange={handleFiltersChange}
                onReset={handleFiltersReset}
              />
            </div>
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
            <TabsTrigger value="voorcalculatie">
              Voorcalculatie
              {(stats?.voorcalculatie || 0) > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats?.voorcalculatie}
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="text-sm font-medium">
                    {selectedIds.size} geselecteerd
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:h-8 sm:w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Separator orientation="vertical" className="hidden sm:block h-6" />
                <Separator orientation="horizontal" className="sm:hidden" />
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
                  <Select
                    value={bulkStatusValue}
                    onValueChange={(value) => {
                      setBulkStatusValue(value);
                      handleBulkStatusChange(value);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[180px] min-h-[44px] sm:min-h-0 sm:h-8">
                      <SelectValue placeholder="Wijzig status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="concept">Concept</SelectItem>
                      <SelectItem value="voorcalculatie">Voorcalculatie</SelectItem>
                      <SelectItem value="verzonden">Verzonden</SelectItem>
                      <SelectItem value="geaccepteerd">Geaccepteerd</SelectItem>
                      <SelectItem value="afgewezen">Afgewezen</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 sm:h-8"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Exporteer
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowBulkDeleteDialog(true)}
                      className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 sm:h-8"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Verwijderen
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={reducedMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reducedMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2 }}
                  className="flex items-center justify-center py-20"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </motion.div>
              ) : sortedOffertes.length > 0 ? (
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
                          <SortableTableHead<SortableOfferte>
                            sortKey="type"
                            sortConfig={sortConfig}
                            onSort={toggleSort}
                          >
                            Type
                          </SortableTableHead>
                          <SortableTableHead<SortableOfferte>
                            sortKey="offerteNummer"
                            sortConfig={sortConfig}
                            onSort={toggleSort}
                          >
                            Nummer
                          </SortableTableHead>
                          <SortableTableHead<SortableOfferte>
                            sortKey="klantNaam"
                            sortConfig={sortConfig}
                            onSort={toggleSort}
                          >
                            Klant
                          </SortableTableHead>
                          <SortableTableHead<SortableOfferte>
                            sortKey="klantPlaats"
                            sortConfig={sortConfig}
                            onSort={toggleSort}
                          >
                            Plaats
                          </SortableTableHead>
                          <SortableTableHead<SortableOfferte>
                            sortKey="bedrag"
                            sortConfig={sortConfig}
                            onSort={toggleSort}
                          >
                            Bedrag
                          </SortableTableHead>
                          <SortableTableHead<SortableOfferte>
                            sortKey="status"
                            sortConfig={sortConfig}
                            onSort={toggleSort}
                          >
                            Status
                          </SortableTableHead>
                          <SortableTableHead<SortableOfferte>
                            sortKey="datum"
                            sortConfig={sortConfig}
                            onSort={toggleSort}
                          >
                            Datum
                          </SortableTableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedOffertes.map((sortableOfferte, index) => (
                          <OfferteRow
                            key={sortableOfferte._id}
                            offerte={sortableOfferte.original}
                            projectInfo={projectsByOfferte?.[sortableOfferte._id] ?? null}
                            isSelected={selectedIds.has(sortableOfferte._id)}
                            onToggleSelect={toggleSelect}
                            onDuplicate={handleDuplicate}
                            onDelete={handleDelete}
                            onNavigate={handleNavigate}
                            reducedMotion={reducedMotion}
                            index={index}
                          />
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
