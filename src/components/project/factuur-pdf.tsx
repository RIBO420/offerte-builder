"use client";

import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { getDefaultTheme } from "@/components/pdf/pdf-theme";
import type { PdfTheme } from "@/components/pdf/pdf-theme";
import type { Bedrijfsgegevens } from "@/types/offerte";

// Factuur line item
interface FactuurRegel {
  id: string;
  omschrijving: string;
  aantal: number;
  eenheid: string;
  prijsPerEenheid: number;
  totaal: number;
}

// Correction/adjustment line
interface FactuurCorrectie {
  id: string;
  omschrijving: string;
  bedrag: number; // Positive for additions, negative for deductions
}

// Factuur data structure
interface Factuur {
  factuurnummer: string;
  factuurdatum: number; // timestamp
  vervaldatum: number; // timestamp
  klant: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  };
  projectReferentie?: string;
  offerteNummer?: string;
  regels: FactuurRegel[];
  correcties?: FactuurCorrectie[];
  subtotaal: number;
  btwPercentage: number;
  btw: number;
  totaalInclBtw: number;
  betaalInstructies?: string;
  notities?: string;
}

interface FactuurPDFProps {
  factuur: Factuur;
  bedrijfsgegevens?: Bedrijfsgegevens;
  theme?: PdfTheme;
  voorwaarden?: string;
}

// Factuur-specific styles derived from theme tokens
function createFactuurStyles(t: PdfTheme) {
  return StyleSheet.create({
    page: {
      padding: t.spacing.pagePadding,
      fontSize: t.typography.bodySize,
      fontFamily: t.typography.fontFamily,
      color: t.colors.text,
    },
    // Header section
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: t.spacing.sectionGap + 10,
    },
    companyInfo: {
      flexDirection: "column",
      maxWidth: 250,
    },
    logoPlaceholder: {
      width: 80,
      height: 40,
      backgroundColor: t.colors.tableHeaderBg,
      marginBottom: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    logoText: {
      fontSize: 8,
      color: t.colors.muted,
    },
    logo: {
      width: t.header.logoSize,
      height: t.header.logoSize,
      marginBottom: 10,
    },
    logoTextContainer: {
      width: t.header.logoSize,
      height: t.header.logoSize,
      marginBottom: 10,
      backgroundColor: t.colors.primary,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
    },
    logoTextTop: {
      fontSize: Math.round(t.header.logoSize / 6),
      fontFamily: "Helvetica-Bold",
      color: "#ffffff",
      textAlign: "center",
    },
    logoTextTuinen: {
      fontSize: Math.round(t.header.logoSize / 8.5),
      fontFamily: "Helvetica-Bold",
      color: "#ffffff",
      textAlign: "center",
      letterSpacing: 2,
    },
    companyName: {
      fontSize: t.typography.headerSize - 2,
      fontFamily: "Helvetica-Bold",
      color: t.colors.primary,
      marginBottom: 4,
    },
    companyDetail: {
      fontSize: t.typography.smallSize,
      color: t.colors.muted,
      marginBottom: 2,
    },
    companyNumbers: {
      marginTop: 8,
    },
    // Title section
    titleSection: {
      marginBottom: t.spacing.sectionGap + 5,
    },
    factuurTitle: {
      fontSize: 24,
      fontFamily: "Helvetica-Bold",
      color: t.colors.text,
      letterSpacing: 2,
    },
    // Factuur meta info (right side)
    factuurMeta: {
      marginBottom: t.spacing.sectionGap + 5,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    metaBlock: {
      width: "48%",
    },
    metaRow: {
      flexDirection: "row",
      marginBottom: t.spacing.itemGap,
    },
    metaLabel: {
      width: 100,
      fontSize: t.typography.smallSize,
      color: t.colors.muted,
    },
    metaValue: {
      flex: 1,
      fontSize: t.typography.bodySize,
      fontFamily: "Helvetica-Bold",
    },
    // Client address block
    addressSection: {
      marginBottom: t.spacing.sectionGap + 5,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    addressTitle: {
      fontSize: t.typography.smallSize,
      fontFamily: "Helvetica-Bold",
      color: t.colors.muted,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    addressText: {
      fontSize: t.typography.bodySize,
      marginBottom: 2,
      lineHeight: 1.4,
    },
    addressName: {
      fontSize: t.typography.titleSize - 1,
      fontFamily: "Helvetica-Bold",
      marginBottom: 4,
    },
    // Line items table
    table: {
      marginBottom: t.spacing.sectionGap,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: t.table.headerStyle === "dark" ? t.colors.tableHeaderBg : t.table.headerStyle === "filled" ? t.colors.primary : "transparent",
      borderBottomWidth: t.table.headerStyle === "underlined" ? 2 : 0,
      borderBottomColor: t.table.headerStyle === "underlined" ? t.colors.secondary : "transparent",
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    tableHeaderCell: {
      fontSize: t.typography.smallSize,
      fontFamily: "Helvetica-Bold",
      color: t.table.headerStyle === "underlined" ? t.colors.text : "#ffffff",
    },
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: t.table.showBorders ? 1 : 0,
      borderBottomColor: t.colors.border,
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    tableRowAlt: {
      flexDirection: "row",
      borderBottomWidth: t.table.showBorders ? 1 : 0,
      borderBottomColor: t.colors.border,
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: t.table.alternateRows ? t.colors.tableAltRowBg : "transparent",
    },
    tableCell: {
      fontSize: t.typography.smallSize,
    },
    tableCellRight: {
      fontSize: t.typography.smallSize,
      textAlign: "right",
    },
    colOmschrijving: {
      flex: 4,
    },
    colAantal: {
      flex: 1,
      textAlign: "right",
    },
    colEenheid: {
      flex: 1,
      textAlign: "center",
    },
    colPrijs: {
      flex: 1.5,
      textAlign: "right",
    },
    colTotaal: {
      flex: 1.5,
      textAlign: "right",
    },
    // Corrections section
    correctiesSection: {
      marginBottom: 15,
      padding: 12,
      backgroundColor: "#fff9e6",
      borderRadius: 4,
      borderWidth: 1,
      borderColor: "#f0e6b3",
    },
    correctiesTitle: {
      fontSize: t.typography.bodySize,
      fontFamily: "Helvetica-Bold",
      marginBottom: 8,
      color: "#996600",
    },
    correctieRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: t.spacing.itemGap,
    },
    correctieOmschrijving: {
      fontSize: t.typography.smallSize,
      flex: 1,
    },
    correctieBedrag: {
      fontSize: t.typography.smallSize,
      width: 80,
      textAlign: "right",
    },
    correctieBedragPositive: {
      fontSize: t.typography.smallSize,
      width: 80,
      textAlign: "right",
      color: t.colors.primary,
    },
    correctieBedragNegative: {
      fontSize: t.typography.smallSize,
      width: 80,
      textAlign: "right",
      color: "#dc2626",
    },
    // Totals section
    totalsSection: {
      marginTop: 10,
      marginLeft: "auto",
      width: 250,
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
      paddingHorizontal: 8,
    },
    totalsLabel: {
      fontSize: t.typography.bodySize,
      color: t.colors.muted,
    },
    totalsValue: {
      fontSize: t.typography.bodySize,
      textAlign: "right",
    },
    totalsDivider: {
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      marginVertical: 8,
    },
    totalsFinalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 10,
      backgroundColor: t.colors.primary,
      borderRadius: 4,
    },
    totalsFinalLabel: {
      fontSize: t.typography.titleSize,
      fontFamily: "Helvetica-Bold",
      color: "#ffffff",
    },
    totalsFinalValue: {
      fontSize: t.typography.titleSize,
      fontFamily: "Helvetica-Bold",
      color: "#ffffff",
      textAlign: "right",
    },
    // Payment section
    paymentSection: {
      marginTop: t.spacing.sectionGap + 10,
      padding: 15,
      backgroundColor: t.colors.background,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.primary,
    },
    paymentTitle: {
      fontSize: t.typography.titleSize - 1,
      fontFamily: "Helvetica-Bold",
      marginBottom: 10,
      color: t.colors.primary,
    },
    paymentRow: {
      flexDirection: "row",
      marginBottom: t.spacing.itemGap,
    },
    paymentLabel: {
      width: 120,
      fontSize: t.typography.smallSize,
      color: t.colors.muted,
    },
    paymentValue: {
      flex: 1,
      fontSize: t.typography.bodySize,
      fontFamily: "Helvetica-Bold",
    },
    paymentIban: {
      fontSize: t.typography.titleSize,
      fontFamily: "Helvetica-Bold",
      color: t.colors.primary,
      letterSpacing: 1,
    },
    paymentInstructions: {
      marginTop: 10,
      fontSize: t.typography.smallSize,
      color: t.colors.muted,
      lineHeight: 1.4,
    },
    // Notes section
    notesSection: {
      marginTop: t.spacing.sectionGap,
      padding: 12,
      backgroundColor: "#f9f9f9",
      borderRadius: 4,
    },
    notesTitle: {
      fontSize: t.typography.bodySize,
      fontFamily: "Helvetica-Bold",
      marginBottom: 6,
      color: t.colors.muted,
    },
    notesText: {
      fontSize: t.typography.smallSize,
      color: t.colors.muted,
      lineHeight: 1.4,
    },
    // Footer
    footer: {
      position: "absolute",
      bottom: 25,
      left: t.spacing.pagePadding,
      right: t.spacing.pagePadding,
      paddingTop: 15,
      borderTopWidth: t.footer.showLine ? 1 : 0,
      borderTopColor: t.colors.border,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: 4,
    },
    footerText: {
      fontSize: 8,
      color: t.colors.muted,
      textAlign: "center",
    },
    footerDivider: {
      fontSize: 8,
      color: t.colors.border,
      marginHorizontal: 8,
    },
  });
}

// Helper functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

const formatDate = (timestamp: number): string => {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
};

export function FactuurPDF({ factuur, bedrijfsgegevens, theme, voorwaarden }: FactuurPDFProps) {
  const t = theme ?? getDefaultTheme();
  const styles = createFactuurStyles(t);

  const companyName = bedrijfsgegevens?.naam || t.branding.bedrijfsnaam;
  const hasCorrections = factuur.correcties && factuur.correcties.length > 0;
  const totalCorrections = factuur.correcties?.reduce((sum, c) => sum + c.bedrag, 0) || 0;

  // Resolve logo source: theme branding → bedrijfsgegevens → null
  const logoSrc = t.branding.logoUrl || bedrijfsgegevens?.logo || null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with company info */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            {/* Company Logo */}
            {logoSrc ? (
              <Image style={styles.logo} src={logoSrc} />
            ) : (
              <View style={styles.logoTextContainer}>
                <Text style={styles.logoTextTop}>TOP</Text>
                <Text style={styles.logoTextTuinen}>TUINEN</Text>
              </View>
            )}
            <Text style={styles.companyName}>{companyName}</Text>
            {bedrijfsgegevens && (
              <>
                <Text style={styles.companyDetail}>
                  {bedrijfsgegevens.adres}
                </Text>
                <Text style={styles.companyDetail}>
                  {bedrijfsgegevens.postcode} {bedrijfsgegevens.plaats}
                </Text>
                {bedrijfsgegevens.telefoon && (
                  <Text style={styles.companyDetail}>
                    Tel: {bedrijfsgegevens.telefoon}
                  </Text>
                )}
                {bedrijfsgegevens.email && (
                  <Text style={styles.companyDetail}>
                    {bedrijfsgegevens.email}
                  </Text>
                )}
                <View style={styles.companyNumbers}>
                  {bedrijfsgegevens.kvk && (
                    <Text style={styles.companyDetail}>
                      KvK: {bedrijfsgegevens.kvk}
                    </Text>
                  )}
                  {bedrijfsgegevens.btw && (
                    <Text style={styles.companyDetail}>
                      BTW: {bedrijfsgegevens.btw}
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {/* FACTUUR title */}
        <View style={styles.titleSection}>
          <Text style={styles.factuurTitle}>FACTUUR</Text>
        </View>

        {/* Factuur meta information */}
        <View style={styles.factuurMeta}>
          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Factuurnummer:</Text>
              <Text style={styles.metaValue}>{factuur.factuurnummer}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Factuurdatum:</Text>
              <Text style={styles.metaValue}>
                {formatDate(factuur.factuurdatum)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Vervaldatum:</Text>
              <Text style={styles.metaValue}>
                {formatDate(factuur.vervaldatum)}
              </Text>
            </View>
          </View>
          <View style={styles.metaBlock}>
            {factuur.offerteNummer && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Offertenummer:</Text>
                <Text style={styles.metaValue}>{factuur.offerteNummer}</Text>
              </View>
            )}
            {factuur.projectReferentie && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Projectreferentie:</Text>
                <Text style={styles.metaValue}>{factuur.projectReferentie}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Client address block */}
        <View style={styles.addressSection}>
          <Text style={styles.addressTitle}>Factuuradres</Text>
          <Text style={styles.addressName}>{factuur.klant.naam}</Text>
          <Text style={styles.addressText}>{factuur.klant.adres}</Text>
          <Text style={styles.addressText}>
            {factuur.klant.postcode} {factuur.klant.plaats}
          </Text>
          {factuur.klant.email && (
            <Text style={styles.addressText}>{factuur.klant.email}</Text>
          )}
          {factuur.klant.telefoon && (
            <Text style={styles.addressText}>Tel: {factuur.klant.telefoon}</Text>
          )}
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colOmschrijving]}>
              Omschrijving
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colAantal]}>
              Aantal
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colEenheid]}>
              Eenheid
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colPrijs]}>
              Prijs
            </Text>
            <Text style={[styles.tableHeaderCell, styles.colTotaal]}>
              Totaal
            </Text>
          </View>
          {factuur.regels.map((regel, index) => (
            <View
              key={regel.id}
              style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            >
              <Text style={[styles.tableCell, styles.colOmschrijving]}>
                {regel.omschrijving}
              </Text>
              <Text style={[styles.tableCellRight, styles.colAantal]}>
                {regel.aantal}
              </Text>
              <Text style={[styles.tableCell, styles.colEenheid]}>
                {regel.eenheid}
              </Text>
              <Text style={[styles.tableCellRight, styles.colPrijs]}>
                {formatCurrency(regel.prijsPerEenheid)}
              </Text>
              <Text style={[styles.tableCellRight, styles.colTotaal]}>
                {formatCurrency(regel.totaal)}
              </Text>
            </View>
          ))}
        </View>

        {/* Corrections section (if any) */}
        {hasCorrections && (
          <View style={styles.correctiesSection}>
            <Text style={styles.correctiesTitle}>Correcties / Aanpassingen</Text>
            {factuur.correcties!.map((correctie) => (
              <View key={correctie.id} style={styles.correctieRow}>
                <Text style={styles.correctieOmschrijving}>
                  {correctie.omschrijving}
                </Text>
                <Text
                  style={
                    correctie.bedrag >= 0
                      ? styles.correctieBedragPositive
                      : styles.correctieBedragNegative
                  }
                >
                  {correctie.bedrag >= 0 ? "+" : ""}
                  {formatCurrency(correctie.bedrag)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals section */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotaal:</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(factuur.subtotaal)}
            </Text>
          </View>
          {hasCorrections && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Correcties:</Text>
              <Text style={styles.totalsValue}>
                {totalCorrections >= 0 ? "+" : ""}
                {formatCurrency(totalCorrections)}
              </Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              BTW ({factuur.btwPercentage}%):
            </Text>
            <Text style={styles.totalsValue}>{formatCurrency(factuur.btw)}</Text>
          </View>
          <View style={styles.totalsDivider} />
          <View style={styles.totalsFinalRow}>
            <Text style={styles.totalsFinalLabel}>Totaal incl. BTW:</Text>
            <Text style={styles.totalsFinalValue}>
              {formatCurrency(factuur.totaalInclBtw)}
            </Text>
          </View>
        </View>

        {/* Payment instructions */}
        <View style={styles.paymentSection}>
          <Text style={styles.paymentTitle}>Betaalinstructies</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Te betalen bedrag:</Text>
            <Text style={styles.paymentValue}>
              {formatCurrency(factuur.totaalInclBtw)}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Vervaldatum:</Text>
            <Text style={styles.paymentValue}>
              {formatDate(factuur.vervaldatum)}
            </Text>
          </View>
          {bedrijfsgegevens?.iban && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>IBAN:</Text>
              <Text style={styles.paymentIban}>{bedrijfsgegevens.iban}</Text>
            </View>
          )}
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>T.n.v.:</Text>
            <Text style={styles.paymentValue}>{companyName}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Onder vermelding van:</Text>
            <Text style={styles.paymentValue}>{factuur.factuurnummer}</Text>
          </View>
          {factuur.betaalInstructies && (
            <Text style={styles.paymentInstructions}>
              {factuur.betaalInstructies}
            </Text>
          )}
        </View>

        {/* Notes section (if any) */}
        {factuur.notities && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Opmerkingen</Text>
            <Text style={styles.notesText}>{factuur.notities}</Text>
          </View>
        )}

        {/* Voorwaarden */}
        {voorwaarden && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Voorwaarden</Text>
            <Text style={styles.notesText}>{voorwaarden}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>{companyName}</Text>
            {bedrijfsgegevens?.kvk && (
              <>
                <Text style={styles.footerDivider}>|</Text>
                <Text style={styles.footerText}>KvK: {bedrijfsgegevens.kvk}</Text>
              </>
            )}
            {bedrijfsgegevens?.btw && (
              <>
                <Text style={styles.footerDivider}>|</Text>
                <Text style={styles.footerText}>BTW: {bedrijfsgegevens.btw}</Text>
              </>
            )}
          </View>
          <View style={styles.footerRow}>
            {bedrijfsgegevens?.iban && (
              <Text style={styles.footerText}>IBAN: {bedrijfsgegevens.iban}</Text>
            )}
            {bedrijfsgegevens?.telefoon && (
              <>
                <Text style={styles.footerDivider}>|</Text>
                <Text style={styles.footerText}>
                  Tel: {bedrijfsgegevens.telefoon}
                </Text>
              </>
            )}
            {bedrijfsgegevens?.email && (
              <>
                <Text style={styles.footerDivider}>|</Text>
                <Text style={styles.footerText}>{bedrijfsgegevens.email}</Text>
              </>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}

// Export types for use in other components
export type { Factuur, FactuurRegel, FactuurCorrectie, FactuurPDFProps };
