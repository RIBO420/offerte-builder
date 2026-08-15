"use client";

import { useRouter } from "next/navigation";
import { PaginaReveal } from "@/components/pagina-reveal";
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
import type { OfferteStatus } from "@/lib/constants/statuses";

interface OfferteTableProps {
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
  /** Alleen nog doorgegeven aan `OfferteRow`; de entree hier doet CSS. */
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
  handleStatusChange,
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
    <>
      {/* Geen `AnimatePresence` meer. Die hield met `mode="wait"` de volgende
          staat tegen tot de vorige was uitgefaded — precies het gat waarin de
          tabel leeg stond — en liet elke tak op `opacity: 0` hangen zodra rAF
          stilstond. De takken wisselen nu gewoon; de `key` op de reveal laat de
          CSS-animatie opnieuw starten, en zonder animatieframe staat de inhoud
          er meteen. → src/components/pagina-reveal.tsx */}
      {isLoading ? (
        <div key="loading">
          <OffertesTableSkeleton rows={5} />
        </div>
      ) : sortedOffertes.length > 0 ? (
        <PaginaReveal key="content">
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
                    onStatusChange={handleStatusChange}
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
