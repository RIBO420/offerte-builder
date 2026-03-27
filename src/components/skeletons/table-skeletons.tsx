"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "framer-motion";
import { shimmer, staggerContainer, fadeInUp } from "./skeleton-animations";

// Table Row Skeleton
export function TableRowSkeleton({ columns = 8 }: { columns?: number }) {
  return (
    <m.tr className="border-b" variants={fadeInUp}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <m.div {...shimmer}>
            <Skeleton className="h-5 w-full max-w-[120px]" />
          </m.div>
        </td>
      ))}
    </m.tr>
  );
}

// Offertes Table Skeleton
export function OffertesTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card role="status" aria-busy="true" aria-label="Offertes tabel laden">
      <span className="sr-only">Offertes worden geladen...</span>
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 w-[50px]"><Skeleton className="h-4 w-4" /></th>
              <th className="p-4"><Skeleton className="h-4 w-12" /></th>
              <th className="p-4"><Skeleton className="h-4 w-16" /></th>
              <th className="p-4"><Skeleton className="h-4 w-14" /></th>
              <th className="p-4"><Skeleton className="h-4 w-14" /></th>
              <th className="p-4"><Skeleton className="h-4 w-16" /></th>
              <th className="p-4"><Skeleton className="h-4 w-14" /></th>
              <th className="p-4"><Skeleton className="h-4 w-14" /></th>
              <th className="p-4 w-[50px]"></th>
            </tr>
          </thead>
          <m.tbody
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} columns={9} />
            ))}
          </m.tbody>
        </table>
      </div>
    </Card>
  );
}

// Table Skeleton - Generic table loading skeleton
export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <Card role="status" aria-busy="true" aria-label="Tabel laden">
      <span className="sr-only">Tabel wordt geladen...</span>
      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="p-4">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <m.tbody
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} columns={columns} />
            ))}
          </m.tbody>
        </table>
      </div>
    </Card>
  );
}
