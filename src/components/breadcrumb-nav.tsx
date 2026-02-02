"use client";

import { useBreadcrumb, type UseBreadcrumbOptions } from "@/hooks/use-breadcrumb";
import { SmartBreadcrumb } from "@/components/ui/smart-breadcrumb";

export interface BreadcrumbNavProps extends UseBreadcrumbOptions {
  /**
   * Maximum number of items to show before collapsing to dropdown
   * @default 4
   */
  maxItems?: number;
  /**
   * Show home icon at the beginning
   * @default true
   */
  showHomeIcon?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * BreadcrumbNav - A wrapper component that combines useBreadcrumb hook with SmartBreadcrumb
 *
 * Automatically generates breadcrumbs from the current URL path and renders them
 * using the SmartBreadcrumb component with mobile responsiveness.
 *
 * @example Basic usage
 * ```tsx
 * <BreadcrumbNav />
 * ```
 *
 * @example With custom labels for dynamic routes
 * ```tsx
 * <BreadcrumbNav
 *   customLabels={{
 *     "/offertes/abc123": "Offerte voor Jan Jansen"
 *   }}
 * />
 * ```
 *
 * @example Skip certain segments
 * ```tsx
 * <BreadcrumbNav skipSegments={["dashboard"]} />
 * ```
 */
export function BreadcrumbNav({
  customLabels,
  skipSegments,
  maxItems = 4,
  showHomeIcon = true,
  className,
}: BreadcrumbNavProps) {
  const items = useBreadcrumb({ customLabels, skipSegments });

  return (
    <SmartBreadcrumb
      items={items}
      maxItems={maxItems}
      showHomeIcon={showHomeIcon}
      className={className}
    />
  );
}

export default BreadcrumbNav;
