"use client";

import { useRouter } from "next/navigation";
import { PaginaReveal } from "@/components/pagina-reveal";
import { Checkbox } from "@/components/ui/checkbox";
import { NoOffertes, NoSearchResults } from "@/components/empty-states";
import { OffertesTableSkeleton } from "@/components/skeletons";
import { OfferteCard } from "@/components/offerte/offerte-card";
import type { SortableOfferte, ProjectInfo } from "./types";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface OfferteCardGridProps {
  sortedOffertes: SortableOfferte[];
  projectsByOfferte: Record<string, ProjectInfo> | undefined;
  selectedIds: Set<Id<"offertes">>;
  isAllSelected: boolean;
  toggleSelectAll: () => void;
  toggleSelect: (id: Id<"offertes">) => void;
  handleDuplicate: (id: string) => void;
  handleDelete: (id: string) => void;
  handleNavigate: (id: string) => void;
  /** Alleen nog doorgegeven aan `OfferteCard`; de entree hier doet CSS. */
  reducedMotion: boolean;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function OfferteCardGrid({
  sortedOffertes,
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
}: OfferteCardGridProps) {
  const router = useRouter();

  return (
    <>
      {/* Geen `AnimatePresence` meer. Die hield met `mode="wait"` de volgende
          staat tegen tot de vorige was uitgefaded — precies het gat waarin het
          raster leeg stond — en liet elke tak op `opacity: 0` hangen zodra rAF
          stilstond. De takken wisselen nu gewoon; de `key` op de reveal laat de
          CSS-animatie opnieuw starten, en zonder animatieframe staat de inhoud
          er meteen. → src/components/pagina-reveal.tsx */}
      {isLoading ? (
        <div key="loading">
          <OffertesTableSkeleton rows={5} />
        </div>
      ) : sortedOffertes.length > 0 ? (
        <PaginaReveal key="content" className="space-y-4">
          {/* Select all bar */}
          <div className="flex items-center gap-3 px-1">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Selecteer alle"
            />
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} van ${sortedOffertes.length} geselecteerd`
                : `${sortedOffertes.length} offertes`}
            </span>
          </div>

          {/* Card grid: 1 column on phone, 2 on tablet, 3 on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedOffertes.map((sortableOfferte, index) => (
              <OfferteCard
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
          </div>
        </PaginaReveal>
      ) : searchQuery ? (
        <PaginaReveal key="no-results">
          <NoSearchResults onAction={() => setSearchQuery("")} />
        </PaginaReveal>
      ) : (
        <PaginaReveal key="empty">
          <NoOffertes onAction={() => router.push("/offertes/nieuw/aanleg")} />
        </PaginaReveal>
      )}
    </>
  );
}
