"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, TableProperties } from "lucide-react";
import { BulkActionsBar } from "./bulk-actions-bar";
import { OfferteTable } from "./offerte-table";
import { OfferteCardGrid } from "./offerte-card-grid";
import type { SortConfig } from "@/hooks/use-table-sort";
import type { SortableOfferte, ProjectInfo } from "./types";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { OfferteStatus } from "@/lib/constants/statuses";

type ViewMode = "table" | "cards";

const VIEW_MODE_KEY = "offerte-view-mode";

function getDefaultViewMode(): ViewMode {
  if (typeof window === "undefined") return "table";
  const saved = localStorage.getItem(VIEW_MODE_KEY);
  if (saved === "table" || saved === "cards") return saved;
  return window.innerWidth < 1024 ? "cards" : "table";
}

function saveViewMode(mode: ViewMode) {
  if (typeof window !== "undefined") {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }
}

interface OfferteStats {
  totaal: number;
  concept: number;
  voorcalculatie: number;
  verzonden: number;
  geaccepteerd: number;
  afgewezen: number;
}

interface StatusTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  stats: OfferteStats | undefined;
  // Bulk actions
  selectedCount: number;
  bulkStatusValue: string;
  onBulkStatusChange: (status: string) => void;
  onSetBulkStatusValue: (value: string) => void;
  onClearSelection: () => void;
  onExportCSV: () => void;
  onShowDeleteDialog: () => void;
  // Table props
  sortedOffertes: SortableOfferte[];
  sortConfig: SortConfig<SortableOfferte>;
  toggleSort: (key: keyof SortableOfferte) => void;
  projectsByOfferte: Record<string, ProjectInfo> | undefined;
  selectedIds: Set<Id<"offertes">>;
  isAllSelected: boolean;
  toggleSelectAll: () => void;
  toggleSelect: (id: Id<"offertes">) => void;
  handleStatusChange: (id: string, newStatus: OfferteStatus) => void;
  handleDuplicate: (id: string) => void;
  handleDelete: (id: string) => void;
  handleNavigate: (id: string) => void;
  reducedMotion: boolean;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function StatusTabs({
  activeTab,
  onTabChange,
  stats,
  selectedCount,
  bulkStatusValue,
  onBulkStatusChange,
  onSetBulkStatusValue,
  onClearSelection,
  onExportCSV,
  onShowDeleteDialog,
  sortedOffertes,
  sortConfig,
  toggleSort,
  projectsByOfferte,
  selectedIds,
  isAllSelected,
  toggleSelectAll,
  toggleSelect,
  handleStatusChange,
  handleDuplicate,
  handleDelete,
  handleNavigate,
  reducedMotion,
  isLoading,
  searchQuery,
  setSearchQuery,
}: StatusTabsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Initialize view mode from localStorage / screen width on mount
  useEffect(() => {
    setTimeout(() => setViewMode(getDefaultViewMode()), 0);
  }, []);

  const handleViewModeToggle = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    saveViewMode(mode);
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <TabsList className="flex-1 justify-start overflow-x-auto scrollbar-hide">
          <TabsTrigger value="alle" className="shrink-0">
            Alle
            <Badge variant="secondary" className="ml-2">
              {stats?.totaal || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="concept" className="shrink-0">
            Concept
            {(stats?.concept || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats?.concept}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="voorcalculatie" className="shrink-0">
            Voorcalculatie
            {(stats?.voorcalculatie || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats?.voorcalculatie}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="verzonden" className="shrink-0">
            Verzonden
            {(stats?.verzonden || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats?.verzonden}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="geaccepteerd" className="shrink-0">
            Geaccepteerd
            {(stats?.geaccepteerd || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats?.geaccepteerd}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="afgewezen" className="shrink-0">
            Afgewezen
            {(stats?.afgewezen || 0) > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats?.afgewezen}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* View mode toggle */}
        <div className="hidden sm:flex items-center gap-1 rounded-lg border bg-muted/50 p-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => handleViewModeToggle("table")}
                aria-label="Tabelweergave"
              >
                <TableProperties className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tabelweergave</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={() => handleViewModeToggle("cards")}
                aria-label="Kaartweergave"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Kaartweergave</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <TabsContent value={activeTab} className="space-y-6">
        <BulkActionsBar
          selectedCount={selectedCount}
          bulkStatusValue={bulkStatusValue}
          onBulkStatusChange={onBulkStatusChange}
          onSetBulkStatusValue={onSetBulkStatusValue}
          onClearSelection={onClearSelection}
          onExportCSV={onExportCSV}
          onShowDeleteDialog={onShowDeleteDialog}
        />

        {viewMode === "table" ? (
          <OfferteTable
            sortedOffertes={sortedOffertes}
            sortConfig={sortConfig}
            toggleSort={toggleSort}
            projectsByOfferte={projectsByOfferte}
            selectedIds={selectedIds}
            isAllSelected={isAllSelected}
            toggleSelectAll={toggleSelectAll}
            toggleSelect={toggleSelect}
            handleStatusChange={handleStatusChange}
            handleDuplicate={handleDuplicate}
            handleDelete={handleDelete}
            handleNavigate={handleNavigate}
            reducedMotion={reducedMotion}
            isLoading={isLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        ) : (
          <OfferteCardGrid
            sortedOffertes={sortedOffertes}
            projectsByOfferte={projectsByOfferte}
            selectedIds={selectedIds}
            isAllSelected={isAllSelected}
            toggleSelectAll={toggleSelectAll}
            toggleSelect={toggleSelect}
            handleDuplicate={handleDuplicate}
            handleDelete={handleDelete}
            handleNavigate={handleNavigate}
            reducedMotion={reducedMotion}
            isLoading={isLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
