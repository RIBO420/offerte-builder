"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  /** Current page (1-indexed) */
  page: number;
  /** Total number of items */
  totalCount: number;
  /** Items per page */
  limit: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when limit changes */
  onLimitChange: (limit: number) => void;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Additional class names */
  className?: string;
  /** Whether to show the page size selector */
  showPageSize?: boolean;
  /** Whether to show the "Showing X-Y of Z" text */
  showItemCount?: boolean;
}

/**
 * Reusable pagination component with Dutch labels.
 * Includes page navigation, items per page selector, and item count display.
 */
export function Pagination({
  page,
  totalCount,
  limit,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
  showPageSize = true,
  showItemCount = true,
}: PaginationProps) {
  const totalPages = Math.ceil(totalCount / limit);

  // Calculate the range of items being displayed
  const startItem = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, totalCount);

  // Generate page numbers to display
  const getPageNumbers = (): (number | "ellipsis")[] => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages if there are few enough
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (page > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current page
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePageSizeChange = (value: string) => {
    const newLimit = parseInt(value, 10);
    onLimitChange(newLimit);
    // Reset to first page when changing page size
    onPageChange(1);
  };

  if (totalCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between py-4",
        className
      )}
    >
      {/* Left side: Item count and page size selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {showItemCount && (
          <p className="text-sm text-muted-foreground">
            Toont {startItem}-{endItem} van {totalCount} resultaten
          </p>
        )}

        {showPageSize && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Per pagina:</span>
            <Select
              value={limit.toString()}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={limit.toString()} />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Right side: Page navigation */}
      <div className="flex items-center gap-1">
        {/* First page button */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="Eerste pagina"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous page button */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Vorige pagina"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((pageNum, index) => (
            pageNum === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-muted-foreground"
              >
                ...
              </span>
            ) : (
              <Button
                key={pageNum}
                variant={page === pageNum ? "default" : "outline"}
                size="icon"
                className="h-8 w-8"
                onClick={() => onPageChange(pageNum)}
                aria-label={`Pagina ${pageNum}`}
                aria-current={page === pageNum ? "page" : undefined}
              >
                {pageNum}
              </Button>
            )
          ))}
        </div>

        {/* Mobile: Current page indicator */}
        <span className="sm:hidden text-sm text-muted-foreground px-2">
          {page} / {totalPages}
        </span>

        {/* Next page button */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Volgende pagina"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page button */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Laatste pagina"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Hook for managing pagination state with URL params
 */
export function usePaginationParams(defaultLimit: number = 25) {
  const [searchParams, setSearchParams] = React.useState<URLSearchParams | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setSearchParams(new URLSearchParams(window.location.search));
    }
  }, []);

  const page = searchParams ? parseInt(searchParams.get("page") || "1", 10) : 1;
  const limit = searchParams ? parseInt(searchParams.get("limit") || defaultLimit.toString(), 10) : defaultLimit;

  const setPage = React.useCallback((newPage: number) => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
    setSearchParams(params);
  }, []);

  const setLimit = React.useCallback((newLimit: number) => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    params.set("limit", newLimit.toString());
    params.set("page", "1"); // Reset to first page

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
    setSearchParams(params);
  }, []);

  return { page, limit, setPage, setLimit };
}
