"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

interface CreditnotaRegel {
  id: string;
  omschrijving: string;
  hoeveelheid: number;
  eenheid: string;
  prijsPerEenheid: number;
  totaal: number;
}

interface CreditnotaCorrectie {
  omschrijving: string;
  bedrag: number;
}

interface CreditnotaData {
  factuurnummer: string; // CN-YYYY-NNN
  factuurdatum: number;
  referentieFactuurnummer: string;
  reden: string;
  klant: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  };
  bedrijf: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    kvk?: string;
    btw?: string;
    iban?: string;
    email?: string;
    telefoon?: string;
  };
  regels: CreditnotaRegel[];
  correcties?: CreditnotaCorrectie[];
  subtotaal: number;
  btwPercentage: number;
  btwBedrag: number;
  totaalInclBtw: number;
}

interface CreditnotaPDFProps {
  creditnota: CreditnotaData;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  companyInfo: {
    flexDirection: "column",
    maxWidth: 250,
  },
  companyName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#16a34a",
    marginBottom: 6,
  },
  companyDetail: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.4,
  },
  titleSection: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 9,
    color: "#6b7280",
    width: 120,
    textAlign: "right",
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginLeft: 8,
  },
  // Reden / referentie
  reasonBox: {
    backgroundColor: "#fef2f2",
    border: "1 solid #fecaca",
    borderRadius: 4,
    padding: 12,
    marginBottom: 20,
  },
  reasonLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.4,
  },
  // Client info
  clientSection: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  clientLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  clientName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  clientDetail: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.4,
  },
  // Table
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: "1 solid #d1d5db",
    padding: "8 12",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5 solid #e5e7eb",
    padding: "8 12",
  },
  colDescription: { flex: 4 },
  colQuantity: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1, textAlign: "center" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },
  headerText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  cellText: {
    fontSize: 9,
    color: "#1f2937",
  },
  cellTextBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
  },
  // Correcties
  correctiesSection: {
    marginBottom: 20,
    borderTop: "1 solid #e5e7eb",
    paddingTop: 12,
  },
  correctiesSectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 8,
  },
  correctieRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  correctieText: {
    fontSize: 9,
    color: "#6b7280",
  },
  correctieBedrag: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
  },
  // Totals
  totalsSection: {
    marginTop: 10,
    paddingTop: 12,
    borderTop: "2 solid #1f2937",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginRight: 20,
    width: 150,
    textAlign: "right",
  },
  totalValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    width: 100,
    textAlign: "right",
    color: "#dc2626",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 8,
    borderTop: "1 solid #e5e7eb",
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginRight: 20,
    width: 150,
    textAlign: "right",
  },
  grandTotalValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#dc2626",
    width: 100,
    textAlign: "right",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1 solid #e5e7eb",
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
  },
});

export function CreditnotaPDF({ creditnota }: CreditnotaPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{creditnota.bedrijf.naam}</Text>
            <Text style={styles.companyDetail}>{creditnota.bedrijf.adres}</Text>
            <Text style={styles.companyDetail}>
              {creditnota.bedrijf.postcode} {creditnota.bedrijf.plaats}
            </Text>
            {creditnota.bedrijf.telefoon && (
              <Text style={styles.companyDetail}>
                Tel: {creditnota.bedrijf.telefoon}
              </Text>
            )}
            {creditnota.bedrijf.email && (
              <Text style={styles.companyDetail}>
                E-mail: {creditnota.bedrijf.email}
              </Text>
            )}
          </View>

          <View style={styles.titleSection}>
            <Text style={styles.title}>CREDITNOTA</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Creditnotanummer:</Text>
              <Text style={styles.metaValue}>{creditnota.factuurnummer}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Datum:</Text>
              <Text style={styles.metaValue}>
                {formatDate(creditnota.factuurdatum)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Betreft factuur:</Text>
              <Text style={styles.metaValue}>
                {creditnota.referentieFactuurnummer}
              </Text>
            </View>
          </View>
        </View>

        {/* Reason Box */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reden creditnota:</Text>
          <Text style={styles.reasonText}>{creditnota.reden}</Text>
        </View>

        {/* Client Info */}
        <View style={styles.clientSection}>
          <Text style={styles.clientLabel}>Creditnota aan</Text>
          <Text style={styles.clientName}>{creditnota.klant.naam}</Text>
          <Text style={styles.clientDetail}>{creditnota.klant.adres}</Text>
          <Text style={styles.clientDetail}>
            {creditnota.klant.postcode} {creditnota.klant.plaats}
          </Text>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDescription]}>
              Omschrijving
            </Text>
            <Text style={[styles.headerText, styles.colQuantity]}>Aantal</Text>
            <Text style={[styles.headerText, styles.colUnit]}>Eenheid</Text>
            <Text style={[styles.headerText, styles.colPrice]}>Prijs</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Totaal</Text>
          </View>

          {creditnota.regels.map((regel) => (
            <View key={regel.id} style={styles.tableRow}>
              <Text style={[styles.cellText, styles.colDescription]}>
                {regel.omschrijving}
              </Text>
              <Text style={[styles.cellText, styles.colQuantity]}>
                {regel.hoeveelheid}
              </Text>
              <Text style={[styles.cellText, styles.colUnit]}>
                {regel.eenheid}
              </Text>
              <Text style={[styles.cellText, styles.colPrice]}>
                {formatCurrency(Math.abs(regel.prijsPerEenheid))}
              </Text>
              <Text style={[styles.cellTextBold, styles.colTotal]}>
                {formatCurrency(regel.totaal)}
              </Text>
            </View>
          ))}
        </View>

        {/* Correcties */}
        {creditnota.correcties && creditnota.correcties.length > 0 && (
          <View style={styles.correctiesSection}>
            <Text style={styles.correctiesSectionTitle}>Correcties</Text>
            {creditnota.correcties.map((correctie, index) => (
              <View key={index} style={styles.correctieRow}>
                <Text style={styles.correctieText}>
                  {correctie.omschrijving}
                </Text>
                <Text style={styles.correctieBedrag}>
                  {formatCurrency(correctie.bedrag)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotaal</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(creditnota.subtotaal)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              BTW ({creditnota.btwPercentage}%)
            </Text>
            <Text style={styles.totalValue}>
              {formatCurrency(creditnota.btwBedrag)}
            </Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Totaal creditnota</Text>
            <Text style={styles.grandTotalValue}>
              {formatCurrency(creditnota.totaalInclBtw)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {creditnota.bedrijf.kvk && `KvK: ${creditnota.bedrijf.kvk}`}
            {creditnota.bedrijf.kvk && creditnota.bedrijf.btw && " | "}
            {creditnota.bedrijf.btw && `BTW: ${creditnota.bedrijf.btw}`}
          </Text>
          <Text style={styles.footerText}>
            {creditnota.bedrijf.iban && `IBAN: ${creditnota.bedrijf.iban}`}
          </Text>
          <Text style={styles.footerText}>
            {creditnota.bedrijf.telefoon &&
              `Tel: ${creditnota.bedrijf.telefoon}`}
            {creditnota.bedrijf.telefoon && creditnota.bedrijf.email && " | "}
            {creditnota.bedrijf.email &&
              `E-mail: ${creditnota.bedrijf.email}`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default CreditnotaPDF;
