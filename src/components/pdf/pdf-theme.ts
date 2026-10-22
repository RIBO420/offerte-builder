import { StyleSheet } from "@react-pdf/renderer";
import { PDF_FONT, PDF_KOP } from "./pdf-fonts";

// ── Huisstijl (gids okt 2026, docs/design/huisstijl.md) ─────────────
// Warm zwart en mosgroen dragen het ontwerp; goud is accent (als tekst op wit
// maar 2,6:1, dus alleen lijnen en vlakken); warm wit draagt de informatie.

export const HUISSTIJL = {
  warmZwart: "#0F0F0D",
  warmWit: "#F5F3F0",
  goud: "#A89968",
  champagne: "#C9B89D",
  olijfgroen: "#4A5D45",
  mosgroen: "#3A4A36",
  /** Secundaire tekst: warme grijs, 6,6:1 op wit. */
  warmGrijs: "#5F5D56",
  /** Lijnen en tabelranden: champagnetint. */
  lijn: "#E3DED4",
} as const;

/** Standaard PDF-kleuren wanneer een organisatie niets heeft ingesteld. */
export const DEFAULT_PDF_PRIMAIRE_KLEUR = HUISSTIJL.mosgroen;
export const DEFAULT_PDF_SECUNDAIRE_KLEUR = HUISSTIJL.goud;

// ── Types ────────────────────────────────────────────────────────────

export interface PdfBranding {
  logoUrl: string | null;
  primaireKleur: string;
  secundaireKleur: string;
  bedrijfsnaam: string;
  bedrijfsgegevens: {
    kvkNummer?: string;
    btwNummer?: string;
    iban?: string;
    adres?: string;
    telefoon?: string;
    email?: string;
  };
}

export type TemplateStijl = "klassiek" | "minimalistisch" | "bold";

export interface PdfTheme {
  stijl: TemplateStijl;
  branding: PdfBranding;
  colors: {
    primary: string;
    secondary: string;
    text: string;
    muted: string;
    background: string;
    tableHeaderBg: string;
    tableHeaderText: string;
    tableAltRowBg: string;
    border: string;
  };
  spacing: {
    pagePadding: number;
    sectionGap: number;
    itemGap: number;
  };
  typography: {
    headerSize: number;
    titleSize: number;
    bodySize: number;
    smallSize: number;
    fontFamily: string;
  };
  header: {
    showColorBar: boolean;
    colorBarHeight: number;
    logoSize: number;
    layout: "side-by-side" | "stacked" | "banner";
  };
  table: {
    headerStyle: "filled" | "underlined" | "dark";
    showBorders: boolean;
    alternateRows: boolean;
  };
  footer: {
    showLine: boolean;
    style: "compact" | "spacious" | "banner";
  };
  styles: ReturnType<typeof StyleSheet.create>;
}

// ── Utility functions ────────────────────────────────────────────────

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export const formatDate = (timestamp: number): string => {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
};

// ── Color helpers ────────────────────────────────────────────────────

/**
 * Mix a hex color with white to create a lighter tint.
 * factor: 0 = original color, 1 = white
 */
function lightenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);

  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

// ── Style definitions (internal) ─────────────────────────────────────

interface StijlConfig {
  colors: (primary: string, secondary: string) => PdfTheme["colors"];
  spacing: PdfTheme["spacing"];
  typography: PdfTheme["typography"];
  header: PdfTheme["header"];
  table: PdfTheme["table"];
  footer: PdfTheme["footer"];
}

const klassiekConfig: StijlConfig = {
  colors: (primary, secondary) => ({
    primary,
    secondary,
    text: HUISSTIJL.warmZwart,
    muted: HUISSTIJL.warmGrijs,
    background: "#ffffff",
    tableHeaderBg: primary,
    tableHeaderText: HUISSTIJL.warmWit,
    tableAltRowBg: HUISSTIJL.warmWit,
    border: HUISSTIJL.lijn,
  }),
  spacing: {
    pagePadding: 40,
    sectionGap: 20,
    itemGap: 4,
  },
  typography: {
    headerSize: 18,
    titleSize: 12,
    bodySize: 10,
    smallSize: 9,
    fontFamily: PDF_FONT,
  },
  header: {
    showColorBar: true,
    colorBarHeight: 2,
    logoSize: 60,
    layout: "side-by-side",
  },
  table: {
    headerStyle: "filled",
    showBorders: true,
    alternateRows: true,
  },
  footer: {
    showLine: true,
    style: "compact",
  },
};

const minimalistischConfig: StijlConfig = {
  colors: (primary, secondary) => ({
    primary,
    secondary,
    text: HUISSTIJL.warmZwart,
    muted: HUISSTIJL.warmGrijs,
    background: "#ffffff",
    tableHeaderBg: "transparent",
    tableHeaderText: HUISSTIJL.warmZwart,
    tableAltRowBg: "transparent",
    border: HUISSTIJL.lijn,
  }),
  spacing: {
    pagePadding: 48,
    sectionGap: 24,
    itemGap: 4,
  },
  typography: {
    headerSize: 16,
    titleSize: 11,
    bodySize: 9,
    smallSize: 8,
    fontFamily: PDF_FONT,
  },
  header: {
    showColorBar: false,
    colorBarHeight: 1,
    logoSize: 48,
    layout: "stacked",
  },
  table: {
    headerStyle: "underlined",
    showBorders: false,
    alternateRows: false,
  },
  footer: {
    showLine: false,
    style: "spacious",
  },
};

const boldConfig: StijlConfig = {
  colors: (primary, secondary) => ({
    primary,
    secondary,
    text: HUISSTIJL.warmZwart,
    muted: HUISSTIJL.warmGrijs,
    background: "#ffffff",
    // Bold: mosgroene banner, warm-zwarte tabelkop.
    tableHeaderBg: HUISSTIJL.warmZwart,
    tableHeaderText: HUISSTIJL.warmWit,
    tableAltRowBg: HUISSTIJL.warmWit,
    border: HUISSTIJL.lijn,
  }),
  spacing: {
    pagePadding: 36,
    sectionGap: 18,
    itemGap: 4,
  },
  typography: {
    headerSize: 22,
    titleSize: 13,
    bodySize: 10,
    smallSize: 9,
    fontFamily: PDF_FONT,
  },
  header: {
    showColorBar: true,
    colorBarHeight: 4,
    logoSize: 56,
    layout: "banner",
  },
  table: {
    headerStyle: "dark",
    showBorders: true,
    alternateRows: true,
  },
  footer: {
    showLine: false,
    style: "banner",
  },
};

const stijlConfigs: Record<TemplateStijl, StijlConfig> = {
  klassiek: klassiekConfig,
  minimalistisch: minimalistischConfig,
  bold: boldConfig,
};

// ── StyleSheet factory ───────────────────────────────────────────────

function createPdfStyles(
  colors: PdfTheme["colors"],
  spacing: PdfTheme["spacing"],
  typography: PdfTheme["typography"],
  header: PdfTheme["header"],
  table: PdfTheme["table"],
  footer: PdfTheme["footer"]
): ReturnType<typeof StyleSheet.create> {
  // Determine table header styles based on headerStyle
  const tableHeaderBg =
    table.headerStyle === "filled"
      ? colors.tableHeaderBg
      : table.headerStyle === "dark"
        ? colors.tableHeaderBg
        : "transparent";

  const tableHeaderBorder =
    table.headerStyle === "underlined"
      ? { borderBottomWidth: 2, borderBottomColor: colors.secondary }
      : { borderBottomWidth: 1, borderBottomColor: colors.border };

  // Footer bottom position scales with page padding
  const footerBottom = spacing.pagePadding - 10;

  return StyleSheet.create({
    page: {
      padding: spacing.pagePadding,
      fontSize: typography.bodySize,
      fontFamily: typography.fontFamily,
      color: colors.text,
    },

    // ── Header ─────────────────────────────────────────────────────
    header:
      header.layout === "banner"
        ? {
            backgroundColor: colors.primary,
            marginTop: -spacing.pagePadding,
            marginLeft: -spacing.pagePadding,
            marginRight: -spacing.pagePadding,
            padding: spacing.pagePadding,
            paddingVertical: 20,
            marginBottom: spacing.sectionGap,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            // Goud als accentlijn onder de mosgroene banner.
            borderBottomWidth: header.colorBarHeight,
            borderBottomColor: colors.secondary,
          }
        : {
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: spacing.sectionGap + 10,
            paddingBottom: spacing.sectionGap,
            ...(header.showColorBar
              ? {
                  borderBottomWidth: header.colorBarHeight,
                  borderBottomColor: colors.secondary,
                }
              : header.layout === "stacked"
                ? {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }
                : {}),
          },
    headerLeft: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    logo: {
      width: header.logoSize,
      height: header.logoSize,
      marginRight: 12,
    },
    logoTextContainer: {
      width: header.logoSize,
      height: header.logoSize,
      marginRight: 12,
      backgroundColor: colors.primary,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    logoTextTop: {
      fontSize: Math.round(header.logoSize / 6),
      ...PDF_KOP,
      color: HUISSTIJL.warmWit,
      textAlign: "center",
    },
    logoTextTuinen: {
      fontSize: Math.round(header.logoSize / 8.5),
      ...PDF_KOP,
      color: HUISSTIJL.warmWit,
      textAlign: "center",
      letterSpacing: 2,
    },
    companyInfo: {
      flexDirection: "column",
    },
    companyName: {
      fontSize: typography.headerSize,
      ...PDF_KOP,
      color: header.layout === "banner" ? HUISSTIJL.warmWit : colors.primary,
      marginBottom: 4,
    },
    companyDetail: {
      fontSize: typography.smallSize,
      color: header.layout === "banner" ? `${HUISSTIJL.warmWit}cc` : colors.muted,
      marginBottom: 2,
    },
    offerteInfo: {
      textAlign: "right",
    },
    offerteNummer: {
      fontSize: 14,
      ...PDF_KOP,
      color: header.layout === "banner" ? HUISSTIJL.warmWit : colors.text,
      marginBottom: 4,
    },
    offerteType: {
      fontSize: typography.bodySize,
      color: header.layout === "banner" ? `${HUISSTIJL.warmWit}cc` : colors.muted,
      marginBottom: 2,
    },
    offerteDate: {
      fontSize: typography.smallSize,
      color: header.layout === "banner" ? `${HUISSTIJL.warmWit}cc` : colors.muted,
    },

    // ── Sections ───────────────────────────────────────────────────
    section: {
      marginBottom: spacing.sectionGap,
    },
    sectionTitle: {
      fontSize: typography.titleSize,
      ...PDF_KOP,
      marginBottom: 10,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      color: colors.primary,
    },
    row: {
      flexDirection: "row",
      marginBottom: spacing.itemGap,
    },
    label: {
      width: 100,
      fontSize: typography.smallSize,
      color: colors.muted,
    },
    value: {
      flex: 1,
      fontSize: typography.bodySize,
    },

    // ── Table ──────────────────────────────────────────────────────
    table: {
      marginTop: 10,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: tableHeaderBg,
      ...tableHeaderBorder,
      paddingVertical: 8,
      paddingHorizontal: 6,
    },
    tableHeaderCell: {
      fontSize: typography.smallSize,
      ...PDF_KOP,
      color: colors.tableHeaderText,
    },
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: table.showBorders ? 1 : 0,
      borderBottomColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 6,
    },
    tableRowAlt: {
      flexDirection: "row",
      borderBottomWidth: table.showBorders ? 1 : 0,
      borderBottomColor: colors.border,
      paddingVertical: 8,
      paddingHorizontal: 6,
      backgroundColor: table.alternateRows ? colors.tableAltRowBg : "transparent",
    },
    tableCell: {
      fontSize: typography.smallSize,
    },
    tableCellRight: {
      fontSize: typography.smallSize,
      textAlign: "right",
    },
    colDescription: {
      flex: 3,
    },
    colScope: {
      flex: 1,
    },
    colQuantity: {
      flex: 1,
      textAlign: "right",
    },
    colPrice: {
      flex: 1,
      textAlign: "right",
    },
    colTotal: {
      flex: 1,
      textAlign: "right",
    },

    // ── Totals ─────────────────────────────────────────────────────
    totalsSection: {
      marginTop: spacing.sectionGap,
      paddingTop: 15,
      borderTopWidth: 2,
      borderTopColor: colors.secondary,
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: spacing.itemGap,
    },
    totalsLabel: {
      width: 150,
      fontSize: typography.bodySize,
      color: colors.muted,
      textAlign: "right",
      paddingRight: 20,
    },
    totalsValue: {
      width: 100,
      fontSize: typography.bodySize,
      textAlign: "right",
    },
    totalsFinalRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalsFinalLabel: {
      width: 150,
      fontSize: typography.titleSize,
      ...PDF_KOP,
      textAlign: "right",
      paddingRight: 20,
    },
    totalsFinalValue: {
      width: 100,
      fontSize: typography.titleSize,
      ...PDF_KOP,
      textAlign: "right",
      color: colors.primary,
    },

    // ── Badges ─────────────────────────────────────────────────────
    scopeBadge: {
      backgroundColor: lightenColor(colors.primary, 0.9),
      color: colors.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 8,
    },

    // ── Footer ─────────────────────────────────────────────────────
    footer:
      footer.style === "banner"
        ? {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.primary,
            paddingVertical: 10,
            paddingHorizontal: spacing.pagePadding,
            textAlign: "center",
            color: HUISSTIJL.warmWit,
            fontSize: typography.smallSize - 1,
          }
        : footer.style === "spacious"
          ? {
              position: "absolute",
              bottom: footerBottom,
              left: spacing.pagePadding,
              right: spacing.pagePadding,
              textAlign: "right",
              color: colors.muted,
              fontSize: typography.smallSize - 1,
              paddingTop: 10,
            }
          : {
              // compact (klassiek)
              position: "absolute",
              bottom: footerBottom,
              left: spacing.pagePadding,
              right: spacing.pagePadding,
              textAlign: "center",
              color: colors.muted,
              fontSize: 8,
              paddingTop: 10,
              ...(footer.showLine
                ? { borderTopWidth: 1, borderTopColor: colors.border }
                : {}),
            },

    // ── Notes ──────────────────────────────────────────────────────
    notesSection: {
      marginTop: spacing.sectionGap,
      padding: 15,
      backgroundColor: HUISSTIJL.warmWit,
      borderRadius: 4,
    },
    notesTitle: {
      fontSize: typography.bodySize,
      ...PDF_KOP,
      marginBottom: 6,
      color: colors.muted,
    },
    notesText: {
      fontSize: typography.smallSize,
      color: colors.muted,
      lineHeight: 1.4,
    },

    // ── Scope details ──────────────────────────────────────────────
    scopeDetails: {
      marginTop: 10,
      padding: 10,
      backgroundColor: HUISSTIJL.warmWit,
      borderRadius: 4,
    },
    scopeDetailTitle: {
      fontSize: typography.bodySize,
      ...PDF_KOP,
      marginBottom: 6,
    },
    scopeDetailRow: {
      flexDirection: "row",
      marginBottom: 3,
    },
    scopeDetailLabel: {
      width: 120,
      fontSize: typography.smallSize,
      color: colors.muted,
    },
    scopeDetailValue: {
      fontSize: typography.smallSize,
    },

    // ── Watermark ──────────────────────────────────────────────────
    watermark: {
      position: "absolute",
      top: "35%",
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: 60,
      ...PDF_KOP,
      color: HUISSTIJL.champagne,
      opacity: 0.3,
      transform: "rotate(-45deg)",
    },
  });
}

// ── Default branding ─────────────────────────────────────────────────

const defaultBranding: PdfBranding = {
  logoUrl: null,
  primaireKleur: DEFAULT_PDF_PRIMAIRE_KLEUR,
  secundaireKleur: DEFAULT_PDF_SECUNDAIRE_KLEUR,
  bedrijfsnaam: "Top Tuinen",
  bedrijfsgegevens: {},
};

// ── Public API ───────────────────────────────────────────────────────

/**
 * Create a complete PdfTheme from branding + style selection.
 * All PDF components use this theme for consistent styling.
 */
export function createPdfTheme(
  branding: PdfBranding,
  stijl: TemplateStijl = "klassiek"
): PdfTheme {
  const config = stijlConfigs[stijl];
  const colors = config.colors(branding.primaireKleur, branding.secundaireKleur);
  const { spacing, typography, header, table, footer } = config;

  const styles = createPdfStyles(colors, spacing, typography, header, table, footer);

  return {
    stijl,
    branding,
    colors,
    spacing,
    typography,
    header,
    table,
    footer,
    styles,
  };
}

/**
 * Get the default theme — klassiek style with Top Tuinen branding.
 * Used as fallback when no branding settings are configured.
 */
export function getDefaultTheme(): PdfTheme {
  return createPdfTheme(defaultBranding, "klassiek");
}
