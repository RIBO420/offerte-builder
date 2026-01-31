"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
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
}

// Factuur-specific styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  // Header section
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  companyInfo: {
    flexDirection: "column",
    maxWidth: 250,
  },
  logoPlaceholder: {
    width: 80,
    height: 40,
    backgroundColor: "#f0f0f0",
    marginBottom: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 8,
    color: "#999999",
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 2,
  },
  companyNumbers: {
    marginTop: 8,
  },
  // Title section
  titleSection: {
    marginBottom: 25,
  },
  factuurTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    letterSpacing: 2,
  },
  // Factuur meta info (right side)
  factuurMeta: {
    marginBottom: 25,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaBlock: {
    width: "48%",
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  metaLabel: {
    width: 100,
    fontSize: 9,
    color: "#666666",
  },
  metaValue: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  // Client address block
  addressSection: {
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  addressTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#666666",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  addressText: {
    fontSize: 10,
    marginBottom: 2,
    lineHeight: 1.4,
  },
  addressName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  // Line items table
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#16a34a",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "#fafafa",
  },
  tableCell: {
    fontSize: 9,
  },
  tableCellRight: {
    fontSize: 9,
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
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    color: "#996600",
  },
  correctieRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  correctieOmschrijving: {
    fontSize: 9,
    flex: 1,
  },
  correctieBedrag: {
    fontSize: 9,
    width: 80,
    textAlign: "right",
  },
  correctieBedragPositive: {
    fontSize: 9,
    width: 80,
    textAlign: "right",
    color: "#16a34a",
  },
  correctieBedragNegative: {
    fontSize: 9,
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
    fontSize: 10,
    color: "#666666",
  },
  totalsValue: {
    fontSize: 10,
    textAlign: "right",
  },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    marginVertical: 8,
  },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#16a34a",
    borderRadius: 4,
  },
  totalsFinalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  totalsFinalValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "right",
  },
  // Payment section
  paymentSection: {
    marginTop: 30,
    padding: 15,
    backgroundColor: "#f0f9f0",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#16a34a",
  },
  paymentTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
    color: "#16a34a",
  },
  paymentRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  paymentLabel: {
    width: 120,
    fontSize: 9,
    color: "#666666",
  },
  paymentValue: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  paymentIban: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
    letterSpacing: 1,
  },
  paymentInstructions: {
    marginTop: 10,
    fontSize: 9,
    color: "#666666",
    lineHeight: 1.4,
  },
  // Notes section
  notesSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: "#666666",
  },
  notesText: {
    fontSize: 9,
    color: "#666666",
    lineHeight: 1.4,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 25,
    left: 40,
    right: 40,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 4,
  },
  footerText: {
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
  },
  footerDivider: {
    fontSize: 8,
    color: "#cccccc",
    marginHorizontal: 8,
  },
});

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

export function FactuurPDF({ factuur, bedrijfsgegevens }: FactuurPDFProps) {
  const companyName = bedrijfsgegevens?.naam || "Top Tuinen";
  const hasCorrections = factuur.correcties && factuur.correcties.length > 0;
  const totalCorrections = factuur.correcties?.reduce((sum, c) => sum + c.bedrag, 0) || 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with company info */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            {/* Logo placeholder */}
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>LOGO</Text>
            </View>
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
