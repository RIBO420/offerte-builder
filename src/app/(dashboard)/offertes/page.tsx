"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { useDebounce } from "@/hooks/use-debounce";
import { useTableSort } from "@/hooks/use-table-sort";
import { RequireAdmin } from "@/components/require-admin";
import { PageHeader } from "@/components/page-header";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import {
  defaultFilters,
  type OfferteFilters,
} from "@/components/offerte/filters";
import {
  useFilterPresets,
  type OfferteFilterState,
} from "@/hooks/use-filter-presets";
import { OffertesTableSkeleton } from "@/components/skeletons";
import type { SortableOfferte } from "./components/types";
import { OfferteToolbar } from "./components/offerte-toolbar";
import { StatusTabs } from "./components/status-tabs";
import { BulkDeleteDialog } from "./components/bulk-delete-dialog";
import { useOfferteActions } from "./components/use-offerte-actions";

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
      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        <OffertesTableSkeleton rows={5} />
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
    isOffertesLoading,
    selectedIds,
    showBulkDeleteDialog,
    setShowBulkDeleteDialog,
    bulkStatusValue,
    setBulkStatusValue,
    optimisticStatusUpdates,
    optimisticDeletedIds,
    handleDuplicate,
    handleDelete,
    handleNavigate,
    toggleSelectAll,
    toggleSelect,
    clearSelection,
    handleBulkStatusChange,
    handleBulkDelete,
    handleExportCSV,
  } = useOfferteActions();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [activeTab, setActiveTab] = useState(searchParams.get("status") || "alle");

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

  const isLoading = !!(isUserLoading || isOffertesLoading);

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

  // Handle preset selection
  const handlePresetSelect = useCallback((presetFilters: OfferteFilterState) => {
    if (presetFilters.status) {
      const statuses = presetFilters.status.split(",");
      if (statuses.length === 1 && ["concept", "voorcalculatie", "verzonden", "geaccepteerd", "afgewezen"].includes(statuses[0])) {
        setActiveTab(statuses[0]);
      } else {
        setActiveTab("alle");
      }
    }

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

  const handleSavePreset = useCallback((name: string, presetFilters: OfferteFilterState) => {
    addPreset(name, presetFilters);
    toast.success(`Preset "${name}" opgeslagen`);
  }, [addPreset]);

  const handleDeletePreset = useCallback((id: string) => {
    deletePreset(id);
    toast.success("Preset verwijderd");
  }, [deletePreset]);

  // Apply optimistic updates to offertes before filtering
  const offertesWithOptimisticUpdates = useMemo(() => {
    if (!offertes) return [];

    return offertes
      .filter((offerte) => !optimisticDeletedIds.has(offerte._id))
      .map((offerte) => {
        const optimisticStatus = optimisticStatusUpdates.get(offerte._id);
        if (optimisticStatus) {
          return { ...offerte, status: optimisticStatus };
        }
        return offerte;
      });
  }, [offertes, optimisticStatusUpdates, optimisticDeletedIds]);

  const filteredOffertes = useMemo(() => {
    return offertesWithOptimisticUpdates.filter((offerte) => {
      const matchesSearch =
        debouncedSearchQuery === "" ||
        offerte.klant.naam.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        offerte.offerteNummer.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      const matchesStatus = activeTab === "alle" || offerte.status === activeTab;
      const matchesType = filters.type === "alle" || offerte.type === filters.type;
      const offerteDate = new Date(offerte.updatedAt);
      const matchesDateFrom = !filters.dateFrom || offerteDate >= filters.dateFrom;
      const matchesDateTo = !filters.dateTo || offerteDate <= new Date(filters.dateTo.getTime() + 86400000);
      const amount = offerte.totalen.totaalInclBtw;
      const matchesAmountMin = !filters.amountMin || amount >= parseFloat(filters.amountMin);
      const matchesAmountMax = !filters.amountMax || amount <= parseFloat(filters.amountMax);

      return matchesSearch && matchesStatus && matchesType && matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax;
    });
  }, [offertesWithOptimisticUpdates, debouncedSearchQuery, activeTab, filters]);

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

  // Apply sorting
  const { sortedData: sortedOffertes, sortConfig, toggleSort } = useTableSort<SortableOfferte>(
    sortableOffertes,
    "datum"
  );

  const isAllSelected = sortedOffertes.length > 0 && selectedIds.size === sortedOffertes.length;

  return (
    <>
      <PageHeader />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
      >
        <OfferteToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onFiltersReset={handleFiltersReset}
          exportData={exportData}
          presets={presets}
          defaultPresets={defaultPresets}
          userPresets={userPresets}
          currentFiltersForPreset={currentFiltersForPreset}
          onPresetSelect={handlePresetSelect}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
          hasActiveFilters={hasActiveFilters}
          reducedMotion={reducedMotion}
        />

        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : 0.3 }}
        >
          <StatusTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            stats={stats}
            selectedCount={selectedIds.size}
            bulkStatusValue={bulkStatusValue}
            onBulkStatusChange={handleBulkStatusChange}
            onSetBulkStatusValue={setBulkStatusValue}
            onClearSelection={clearSelection}
            onExportCSV={() => handleExportCSV(sortedOffertes)}
            onShowDeleteDialog={() => setShowBulkDeleteDialog(true)}
            sortedOffertes={sortedOffertes}
            sortConfig={sortConfig}
            toggleSort={toggleSort}
            projectsByOfferte={projectsByOfferte}
            selectedIds={selectedIds}
            isAllSelected={isAllSelected}
            toggleSelectAll={() => toggleSelectAll(sortedOffertes)}
            toggleSelect={toggleSelect}
            handleDuplicate={handleDuplicate}
            handleDelete={handleDelete}
            handleNavigate={handleNavigate}
            reducedMotion={reducedMotion}
            isLoading={isLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        </motion.div>
      </motion.div>

      <BulkDeleteDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        selectedCount={selectedIds.size}
        onConfirm={handleBulkDelete}
      />
    </>
  );
}
