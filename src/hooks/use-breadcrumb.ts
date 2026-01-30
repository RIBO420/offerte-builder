"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import type { BreadcrumbItem } from "@/components/ui/smart-breadcrumb";

/**
 * Route label mapping
 * Vertaalt URL segmenten naar leesbare Nederlandse labels
 */
const ROUTE_LABELS: Record<string, string> = {
  // Hoofdpagina's
  offertes: "Offertes",
  klanten: "Klanten",
  prijsboek: "Prijsboek",
  instellingen: "Instellingen",
  profiel: "Profiel",

  // Sub-pagina's
  nieuw: "Nieuwe",
  bewerken: "Bewerken",
  history: "Geschiedenis",
  preview: "Preview",
  details: "Details",

  // Prijsboek sub-pagina's
  producten: "Producten",
  normuren: "Normuren",
  correctiefactoren: "Correctiefactoren",
  standaardtuinen: "Standaardtuinen",

  // Instellingen sub-pagina's
  algemeen: "Algemeen",
  bedrijf: "Bedrijf",
  email: "E-mail",
  templates: "Templates",
};

/**
 * Bepaalt of een segment een dynamische ID is
 * Dynamische IDs zijn UUIDs, numerieke IDs of andere dynamische waarden
 */
function isDynamicSegment(segment: string): boolean {
  // UUID pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Numerieke ID
  const numericPattern = /^\d+$/;
  // Korte alphanumerieke ID (bijv. cuid, nanoid)
  const shortIdPattern = /^[a-z0-9]{20,}$/i;

  return (
    uuidPattern.test(segment) ||
    numericPattern.test(segment) ||
    shortIdPattern.test(segment)
  );
}

/**
 * Genereert een leesbaar label voor een dynamisch segment
 * Op basis van de parent route context
 */
function getDynamicLabel(segment: string, parentSegment?: string): string {
  // Kort label op basis van parent context
  switch (parentSegment) {
    case "offertes":
      return `Offerte #${segment.slice(-6)}`;
    case "klanten":
      return `Klant #${segment.slice(-6)}`;
    default:
      return `#${segment.slice(-6)}`;
  }
}

/**
 * Haalt het label op voor een route segment
 */
function getSegmentLabel(segment: string, parentSegment?: string): string {
  // Check of het een bekende route is
  if (ROUTE_LABELS[segment]) {
    return ROUTE_LABELS[segment];
  }

  // Check of het een dynamisch segment is
  if (isDynamicSegment(segment)) {
    return getDynamicLabel(segment, parentSegment);
  }

  // Fallback: capitalize eerste letter
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export interface UseBreadcrumbOptions {
  /**
   * Custom labels voor specifieke paden
   * Key: volledig pad (bijv. "/offertes/123")
   * Value: custom label
   */
  customLabels?: Record<string, string>;

  /**
   * Paden die overgeslagen moeten worden in de breadcrumb
   */
  skipSegments?: string[];
}

/**
 * Hook om automatisch breadcrumbs te genereren uit de URL path
 *
 * @example
 * ```tsx
 * const items = useBreadcrumb();
 * return <SmartBreadcrumb items={items} />;
 * ```
 *
 * @example Met custom labels
 * ```tsx
 * const items = useBreadcrumb({
 *   customLabels: {
 *     "/offertes/abc123": "Offerte voor Jan Jansen"
 *   }
 * });
 * ```
 */
export function useBreadcrumb(options: UseBreadcrumbOptions = {}): BreadcrumbItem[] {
  const pathname = usePathname();
  const { customLabels = {}, skipSegments = [] } = options;

  const items = useMemo(() => {
    // Split pathname in segmenten en filter lege strings
    const segments = pathname
      .split("/")
      .filter((segment) => segment !== "" && !skipSegments.includes(segment));

    // Bouw breadcrumb items op
    const breadcrumbItems: BreadcrumbItem[] = [];
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const parentSegment = index > 0 ? segments[index - 1] : undefined;
      const isLast = index === segments.length - 1;

      // Check voor custom label
      const customLabel = customLabels[currentPath];
      const label = customLabel || getSegmentLabel(segment, parentSegment);

      breadcrumbItems.push({
        label,
        // Laatste item heeft geen href (huidige pagina)
        href: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbItems;
  }, [pathname, customLabels, skipSegments]);

  return items;
}

/**
 * Helper hook om breadcrumbs te genereren met een dynamische entity titel
 * Handig voor pagina's met een specifieke entity (offerte, klant, etc.)
 *
 * @example
 * ```tsx
 * const items = useBreadcrumbWithTitle({
 *   title: offerte?.titel || "Laden...",
 *   basePath: "/offertes"
 * });
 * ```
 */
export function useBreadcrumbWithTitle({
  title,
  basePath,
  additionalItems = [],
}: {
  title: string;
  basePath: string;
  additionalItems?: BreadcrumbItem[];
}): BreadcrumbItem[] {
  const pathname = usePathname();

  return useMemo(() => {
    const items: BreadcrumbItem[] = [];

    // Base path label
    const baseSegment = basePath.replace(/^\//, "");
    const baseLabel = ROUTE_LABELS[baseSegment] || baseSegment;
    items.push({
      label: baseLabel,
      href: basePath,
    });

    // Entity item met custom titel
    const pathAfterBase = pathname.replace(basePath, "");
    const segments = pathAfterBase.split("/").filter(Boolean);

    if (segments.length > 0) {
      // Eerste segment is de ID, vervang met titel
      const entityPath = `${basePath}/${segments[0]}`;

      // Check of er nog sub-pagina's zijn na de entity
      if (segments.length > 1) {
        // Entity is klikbaar
        items.push({
          label: title,
          href: entityPath,
        });

        // Voeg sub-pagina's toe
        let currentPath = entityPath;
        segments.slice(1).forEach((segment, index) => {
          currentPath += `/${segment}`;
          const isLast = index === segments.length - 2;
          const label = ROUTE_LABELS[segment] || segment;

          items.push({
            label,
            href: isLast ? undefined : currentPath,
          });
        });
      } else {
        // Entity is de huidige pagina
        items.push({
          label: title,
          href: undefined,
        });
      }
    }

    // Voeg eventuele extra items toe
    additionalItems.forEach((item, index) => {
      items.push({
        ...item,
        // Laatste additional item heeft geen href
        href: index === additionalItems.length - 1 ? undefined : item.href,
      });
    });

    return items;
  }, [pathname, title, basePath, additionalItems]);
}

export default useBreadcrumb;
