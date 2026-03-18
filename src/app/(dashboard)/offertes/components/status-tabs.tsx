"use client";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkActionsBar } from "./bulk-actions-bar";
import { OfferteTable } from "./offerte-table";
import type { SortConfig } from "@/hooks/use-table-sort";
import type { SortableOfferte, ProjectInfo } from "./types";
import type { Id } from "../../../../../convex/_generated/dataModel";

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
  handleDuplicate,
  handleDelete,
  handleNavigate,
  reducedMotion,
  isLoading,
  searchQuery,
  setSearchQuery,
}: StatusTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
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
        <BulkActionsBar
          selectedCount={selectedCount}
          bulkStatusValue={bulkStatusValue}
          onBulkStatusChange={onBulkStatusChange}
          onSetBulkStatusValue={onSetBulkStatusValue}
          onClearSelection={onClearSelection}
          onExportCSV={onExportCSV}
          onShowDeleteDialog={onShowDeleteDialog}
        />

        <OfferteTable
          sortedOffertes={sortedOffertes}
          sortConfig={sortConfig}
          toggleSort={toggleSort}
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
      </TabsContent>
    </Tabs>
  );
}
