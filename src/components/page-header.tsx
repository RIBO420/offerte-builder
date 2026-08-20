"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { BreadcrumbNav, type BreadcrumbNavProps } from "@/components/breadcrumb-nav";

export interface PageHeaderProps extends BreadcrumbNavProps {
  /**
   * Additional content to render after the breadcrumb (e.g., action buttons)
   */
  children?: React.ReactNode;
}

/**
 * PageHeader - A reusable header component for dashboard pages
 *
 * Includes the sidebar trigger, separator, and breadcrumb navigation.
 * Automatically generates breadcrumbs from the current URL path.
 *
 * @example Basic usage
 * ```tsx
 * <PageHeader />
 * ```
 *
 * @example With custom labels for dynamic routes
 * ```tsx
 * <PageHeader
 *   customLabels={{
 *     "/offertes/abc123": offerte?.titel || "Laden..."
 *   }}
 * />
 * ```
 *
 * @example With additional header content
 * ```tsx
 * <PageHeader>
 *   <Button>Actie</Button>
 * </PageHeader>
 * ```
 */
export function PageHeader({
  customLabels,
  skipSegments,
  maxItems,
  showHomeIcon,
  className,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      {/* Op desktop klapt de balk uit bij hover (vastzetten kan met Cmd+B),
          dus daar is de knop overbodig; op mobiel is hij de enige manier om
          het menu (de Sheet) te openen en blijft hij staan. */}
      <SidebarTrigger className="-ml-1 md:hidden" />
      <Separator orientation="vertical" className="mr-2 h-4 md:hidden" />
      <BreadcrumbNav
        customLabels={customLabels}
        skipSegments={skipSegments}
        maxItems={maxItems}
        showHomeIcon={showHomeIcon}
        className={className}
      />
      {children && (
        <>
          <div className="flex-1" />
          {children}
        </>
      )}
    </header>
  );
}

export default PageHeader;
