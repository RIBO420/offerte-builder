"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Shovel, Trees, Search } from "lucide-react";
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

interface OfferteToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: OfferteFilters;
  onFiltersChange: (filters: OfferteFilters) => void;
  onFiltersReset: () => void;
  // Export
  exportData: Record<string, unknown>[] | undefined;
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
          </div>
        </div>
        <ActiveFilters filters={filters} onChange={onFiltersChange} />
      </m.div>
    </>
  );
}
