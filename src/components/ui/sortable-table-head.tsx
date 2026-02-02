"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";
import { handleKeyboardActivation } from "@/lib/accessibility";
import type { SortConfig } from "@/hooks/use-table-sort";

interface SortableTableHeadProps<T> extends React.ComponentProps<"th"> {
  sortKey: keyof T;
  sortConfig: SortConfig<T>;
  onSort: (key: keyof T) => void;
  children: React.ReactNode;
}

export function SortableTableHead<T>({
  sortKey,
  sortConfig,
  onSort,
  children,
  className,
  ...props
}: SortableTableHeadProps<T>) {
  const isActive = sortConfig.key === sortKey;
  const direction = sortConfig.direction;

  // Determine aria-sort value
  const ariaSort: "ascending" | "descending" | "none" = isActive
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => handleKeyboardActivation(e, () => onSort(sortKey))}
      tabIndex={0}
      role="columnheader"
      aria-sort={ariaSort}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        <span>{children}</span>
        <span className="flex-shrink-0" aria-hidden="true">
          {isActive ? (
            direction === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 text-primary" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 text-primary" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
          )}
        </span>
      </div>
    </TableHead>
  );
}
