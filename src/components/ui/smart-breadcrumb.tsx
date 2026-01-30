"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Home, MoreHorizontal, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface SmartBreadcrumbProps {
  items: BreadcrumbItem[];
  maxItems?: number;
  showHomeIcon?: boolean;
  className?: string;
}

/**
 * SmartBreadcrumb - Een responsive breadcrumb component
 *
 * Features:
 * - Alle items zijn klikbaar (behalve de laatste = huidige pagina)
 * - Collapse tot dropdown bij meer dan maxItems (default 4)
 * - Mobile: Toont alleen parent + huidige pagina of "Terug" knop
 * - Home icon optioneel aan het begin
 * - Separator: ChevronRight icon
 * - Laatste item: niet klikbaar, font-medium
 * - Truncate lange labels met ellipsis
 */
export function SmartBreadcrumb({
  items,
  maxItems = 4,
  showHomeIcon = true,
  className,
}: SmartBreadcrumbProps) {
  const isMobile = useIsMobile();

  // Als er geen items zijn, render niets
  if (!items || items.length === 0) {
    return null;
  }

  // Mobile layout
  if (isMobile) {
    return (
      <MobileBreadcrumb
        items={items}
        showHomeIcon={showHomeIcon}
        className={className}
      />
    );
  }

  // Desktop layout
  return (
    <DesktopBreadcrumb
      items={items}
      maxItems={maxItems}
      showHomeIcon={showHomeIcon}
      className={className}
    />
  );
}

/**
 * Mobile Breadcrumb Layout
 * Toont: [<- Parent] / Current
 * Of alleen: [<- Terug] als er maar 1 item is
 */
function MobileBreadcrumb({
  items,
  showHomeIcon,
  className,
}: {
  items: BreadcrumbItem[];
  showHomeIcon: boolean;
  className?: string;
}) {
  const current = items[items.length - 1];
  const parent = items.length > 1 ? items[items.length - 2] : null;

  return (
    <nav aria-label="breadcrumb" className={cn("flex items-center", className)}>
      <ol className="flex items-center gap-1.5 text-sm">
        {parent && parent.href ? (
          <>
            {/* Back to parent link */}
            <li className="inline-flex items-center">
              <Link
                href={parent.href}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                <span className="max-w-[120px] truncate">{parent.label}</span>
              </Link>
            </li>
            {/* Separator */}
            <li
              role="presentation"
              aria-hidden="true"
              className="[&>svg]:size-3.5"
            >
              <ChevronRight className="text-muted-foreground" />
            </li>
            {/* Current page */}
            <li className="inline-flex items-center">
              <span
                role="link"
                aria-disabled="true"
                aria-current="page"
                className="font-medium text-foreground max-w-[120px] truncate"
              >
                {current.label}
              </span>
            </li>
          </>
        ) : items.length === 1 && showHomeIcon ? (
          // Alleen huidige pagina met optionele home link
          <>
            <li className="inline-flex items-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                <Home className="size-3.5" />
              </Link>
            </li>
            <li
              role="presentation"
              aria-hidden="true"
              className="[&>svg]:size-3.5"
            >
              <ChevronRight className="text-muted-foreground" />
            </li>
            <li className="inline-flex items-center">
              <span
                role="link"
                aria-disabled="true"
                aria-current="page"
                className="font-medium text-foreground max-w-[120px] truncate"
              >
                {current.label}
              </span>
            </li>
          </>
        ) : (
          // Fallback: alleen huidige pagina
          <li className="inline-flex items-center">
            <span
              role="link"
              aria-disabled="true"
              aria-current="page"
              className="font-medium text-foreground max-w-[200px] truncate"
            >
              {current.label}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}

/**
 * Desktop Breadcrumb Layout
 * Toont: Home > Parent > ... > Grandparent > Current
 * (... is een dropdown met verborgen items)
 */
function DesktopBreadcrumb({
  items,
  maxItems,
  showHomeIcon,
  className,
}: {
  items: BreadcrumbItem[];
  maxItems: number;
  showHomeIcon: boolean;
  className?: string;
}) {
  const shouldCollapse = items.length > maxItems;

  // Bepaal welke items te tonen en welke te verbergen
  let visibleItems: BreadcrumbItem[];
  let hiddenItems: BreadcrumbItem[] = [];

  if (shouldCollapse) {
    // Toon: eerste item, ..., laatste 2 items
    const firstItem = items[0];
    const lastItems = items.slice(-2);
    hiddenItems = items.slice(1, -2);
    visibleItems = [firstItem, ...lastItems];
  } else {
    visibleItems = items;
  }

  return (
    <nav aria-label="breadcrumb" className={cn("flex items-center", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm sm:gap-2.5">
        {/* Optional Home Icon */}
        {showHomeIcon && (
          <>
            <li className="inline-flex items-center">
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Home"
              >
                <Home className="size-4" />
              </Link>
            </li>
            <li
              role="presentation"
              aria-hidden="true"
              className="[&>svg]:size-3.5"
            >
              <ChevronRight className="text-muted-foreground" />
            </li>
          </>
        )}

        {/* Render visible items with potential ellipsis dropdown */}
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const isFirst = index === 0;
          const showEllipsis = shouldCollapse && isFirst;

          return (
            <React.Fragment key={item.href || item.label}>
              {/* Breadcrumb Item */}
              <li className="inline-flex items-center gap-1.5">
                {item.icon && (
                  <span className="[&>svg]:size-4 text-muted-foreground">
                    {item.icon}
                  </span>
                )}
                {isLast ? (
                  // Laatste item: niet klikbaar, font-medium
                  <span
                    role="link"
                    aria-disabled="true"
                    aria-current="page"
                    className="font-medium text-foreground max-w-[200px] truncate"
                    title={item.label}
                  >
                    {item.label}
                  </span>
                ) : item.href ? (
                  // Klikbaar item
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-foreground transition-colors max-w-[150px] truncate"
                    title={item.label}
                  >
                    {item.label}
                  </Link>
                ) : (
                  // Niet-klikbaar item (geen href)
                  <span
                    className="text-muted-foreground max-w-[150px] truncate"
                    title={item.label}
                  >
                    {item.label}
                  </span>
                )}
              </li>

              {/* Separator */}
              {!isLast && (
                <li
                  role="presentation"
                  aria-hidden="true"
                  className="[&>svg]:size-3.5"
                >
                  <ChevronRight className="text-muted-foreground" />
                </li>
              )}

              {/* Ellipsis dropdown na eerste item */}
              {showEllipsis && hiddenItems.length > 0 && (
                <>
                  <li className="inline-flex items-center">
                    <EllipsisDropdown items={hiddenItems} />
                  </li>
                  <li
                    role="presentation"
                    aria-hidden="true"
                    className="[&>svg]:size-3.5"
                  >
                    <ChevronRight className="text-muted-foreground" />
                  </li>
                </>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Dropdown voor verborgen breadcrumb items
 */
function EllipsisDropdown({ items }: { items: BreadcrumbItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
        aria-label="Meer pagina's tonen"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => (
          <DropdownMenuItem key={item.href || item.label} asChild>
            {item.href ? (
              <Link href={item.href} className="flex items-center gap-2">
                {item.icon && (
                  <span className="[&>svg]:size-4">{item.icon}</span>
                )}
                <span className="max-w-[200px] truncate">{item.label}</span>
              </Link>
            ) : (
              <span className="flex items-center gap-2">
                {item.icon && (
                  <span className="[&>svg]:size-4">{item.icon}</span>
                )}
                <span className="max-w-[200px] truncate">{item.label}</span>
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SmartBreadcrumb;
