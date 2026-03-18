"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollableTable } from "@/components/ui/responsive-table";
import { NoOffertes, NoSearchResults } from "@/components/empty-states";
import { OffertesTableSkeleton } from "@/components/skeletons";
import type { SortConfig } from "@/hooks/use-table-sort";
import { OfferteRow } from "./offerte-row";
import type { SortableOfferte, ProjectInfo } from "./types";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface OfferteTableProps {
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

export function OfferteTable({
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
}: OfferteTableProps) {
  const router = useRouter();

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        >
          <OffertesTableSkeleton rows={5} />
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
  );
}
