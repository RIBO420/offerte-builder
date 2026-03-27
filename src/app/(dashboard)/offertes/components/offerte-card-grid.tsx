"use client";

import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "framer-motion";
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
    <AnimatePresence mode="wait">
      {isLoading ? (
        <m.div
          key="loading"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        >
          <OffertesTableSkeleton rows={5} />
        </m.div>
      ) : sortedOffertes.length > 0 ? (
        <m.div
          key="content"
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: reducedMotion ? 0 : 0.4 }}
          className="space-y-4"
        >
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
        </m.div>
      ) : searchQuery ? (
        <m.div
          key="no-results"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
          transition={{ duration: reducedMotion ? 0 : 0.3 }}
        >
          <NoSearchResults onAction={() => setSearchQuery("")} />
        </m.div>
      ) : (
        <m.div
          key="empty"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
          transition={{ duration: reducedMotion ? 0 : 0.3 }}
        >
          <NoOffertes onAction={() => router.push("/offertes/nieuw/aanleg")} />
        </m.div>
      )}
    </AnimatePresence>
  );
}
