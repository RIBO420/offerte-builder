"use client";

import { m } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import {
  OfferteFiltersComponent,
  ActiveFilters,
  type OfferteFilters,
} from "@/components/offerte/filters";
import { FilterPresetSelector } from "@/components/ui/filter-preset-selector";
import type { OfferteFilterState, FilterPreset } from "@/hooks/use-filter-presets";
import {
  ExportDropdown,
  offerteExportColumns,
} from "@/components/export-dropdown";
import { ConceptOpruimenDialog } from "./concept-opruimen-dialog";
import { useShortcuts } from "@/components/providers/shortcuts-provider";

interface OfferteToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: OfferteFilters;
  onFiltersChange: (filters: OfferteFilters) => void;
  onFiltersReset: () => void;
  // Export (kantoor-functionaliteit, PRD §1.2)
  exportData: Record<string, unknown>[] | undefined;
  isKantoor: boolean;
  // Presets
  presets: FilterPreset<OfferteFilterState>[];
  defaultPresets: FilterPreset<OfferteFilterState>[];
  userPresets: FilterPreset<OfferteFilterState>[];
  currentFiltersForPreset: OfferteFilterState;
  onPresetSelect: (filters: OfferteFilterState) => void;
  onSavePreset: (name: string, filters: OfferteFilterState) => void;
  onDeletePreset: (id: string) => void;
  hasActiveFilters: boolean;
  reducedMotion: boolean;
}

export function OfferteToolbar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  onFiltersReset,
  exportData,
  isKantoor,
  presets,
  defaultPresets,
  userPresets,
  currentFiltersForPreset,
  onPresetSelect,
  onSavePreset,
  onDeletePreset,
  hasActiveFilters,
  reducedMotion,
}: OfferteToolbarProps) {
  // Eén ingang voor "nieuwe offerte": de NewOfferteDialog (8 tegels, TT-004)
  // die in de dashboard-layout gemount staat — zelfde dialoog als ⌘N.
  const { setShowNewOfferteDialog } = useShortcuts();

  return (
    <>
      <m.div
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
        {/* Eén primaire ingang (keuzepunt 7): de dialoog kiest de werkzaamheid */}
        <Button
          className="w-full sm:w-auto"
          onClick={() => setShowNewOfferteDialog(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe offerte
        </Button>
      </m.div>

      <m.div
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
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isKantoor && (
              <ExportDropdown
                getData={() => exportData ?? []}
                columns={offerteExportColumns}
                filename="offertes"
                sheetName="Offertes"
                disabled={!exportData || exportData.length === 0}
              />
            )}
            <FilterPresetSelector<OfferteFilterState>
              presets={presets}
              defaultPresets={defaultPresets}
              userPresets={userPresets}
              currentFilters={currentFiltersForPreset}
              onSelectPreset={onPresetSelect}
              onSavePreset={onSavePreset}
              onDeletePreset={onDeletePreset}
              hasActiveFilters={hasActiveFilters}
            />
            <OfferteFiltersComponent
              filters={filters}
              onChange={onFiltersChange}
              onReset={onFiltersReset}
            />
            {/* §5.3c: schoonmaakactie, gedegradeerd uit de headerregel */}
            <ConceptOpruimenDialog />
          </div>
        </div>
        <ActiveFilters filters={filters} onChange={onFiltersChange} />
      </m.div>
    </>
  );
}
