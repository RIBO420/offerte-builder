"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Types for responsive table
export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  // Priority determines visibility on smaller screens (lower = more important)
  priority?: number;
  // Alignment for the cell
  align?: "left" | "center" | "right";
  // Whether this column should be shown in mobile card view
  showInCard?: boolean;
  // Label to show in mobile card view (defaults to header)
  mobileLabel?: string;
  // Whether this is the primary/title field in mobile view
  isPrimary?: boolean;
  // Whether this is the secondary field in mobile view
  isSecondary?: boolean;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  // Breakpoint at which to switch to card view (default: sm = 640px)
  mobileBreakpoint?: "sm" | "md" | "lg";
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = "Geen items gevonden",
  className,
  mobileBreakpoint = "sm",
}: ResponsiveTableProps<T>) {
  const breakpointClass = {
    sm: "sm:table",
    md: "md:table",
    lg: "lg:table",
  }[mobileBreakpoint];

  const cardBreakpointClass = {
    sm: "sm:hidden",
    md: "md:hidden",
    lg: "lg:hidden",
  }[mobileBreakpoint];

  // Get columns for different views
  const primaryColumn = columns.find((col) => col.isPrimary);
  const secondaryColumn = columns.find((col) => col.isSecondary);
  const cardColumns = columns.filter(
    (col) => col.showInCard !== false && !col.isPrimary && !col.isSecondary
  );

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Desktop/Tablet Table View */}
      <div className={cn("hidden", breakpointClass)}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center"
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center"
                    )}
                  >
                    {column.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className={cn("space-y-3", cardBreakpointClass)}>
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            onClick={() => onRowClick?.(item)}
            className={cn(
              "rounded-lg border bg-card p-4 space-y-3",
              onRowClick && "cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
            )}
          >
            {/* Primary and secondary info */}
            {(primaryColumn || secondaryColumn) && (
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0 flex-1">
                  {primaryColumn && (
                    <div className="font-medium truncate">
                      {primaryColumn.render(item)}
                    </div>
                  )}
                  {secondaryColumn && (
                    <div className="text-sm text-muted-foreground truncate">
                      {secondaryColumn.render(item)}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Other fields in a grid */}
            {cardColumns.length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {cardColumns.slice(0, 4).map((column) => (
                  <div key={column.key} className="space-y-0.5">
                    <div className="text-muted-foreground text-xs">
                      {column.mobileLabel || column.header}
                    </div>
                    <div className="font-medium truncate">
                      {column.render(item)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Simpler variant that just adds horizontal scroll with shadow indicators
interface ScrollableTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollableTable({ children, className }: ScrollableTableProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = React.useState(false);
  const [showRightShadow, setShowRightShadow] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    setShowLeftShadow(el.scrollLeft > 0);
    setShowRightShadow(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  return (
    <div className={cn("relative", className)}>
      {/* Left shadow */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity",
          showLeftShadow ? "opacity-100" : "opacity-0"
        )}
      />
      {/* Right shadow */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity",
          showRightShadow ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        ref={scrollRef}
        className="overflow-x-auto -webkit-overflow-scrolling-touch"
      >
        {children}
      </div>
    </div>
  );
}
