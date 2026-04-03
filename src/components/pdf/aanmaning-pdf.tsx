"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { getDefaultTheme } from "./pdf-theme";
import type { PdfTheme } from "./pdf-theme";

type AanmaningType = "eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling";

interface AanmaningPDFData {
  type: AanmaningType;
  datum: number;
  factuurNummer: string;
  factuurDatum: number;
  vervaldatum: number;
  dagenVervallen: number;
  totaalInclBtw: number;
  klant: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
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
}

interface AanmaningPDFProps {
  aanmaning: AanmaningPDFData;
  theme?: PdfTheme;
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

const typeConfig: Record<AanmaningType, {
  titel: string;
  headerColor: string;
  aanhef: string;
  body: string[];
  afsluiting: string[];
}> = {
  eerste_aanmaning: {
    titel: "EERSTE AANMANING",
    headerColor: "#f59e0b",
    aanhef: "Geachte",
    body: [
      "Volgens onze administratie is de hieronder vermelde factuur nog niet voldaan. De betalingstermijn is inmiddels verstreken.",
      "Wij verzoeken u vriendelijk het openstaande bedrag alsnog binnen 7 dagen over te maken op ons rekeningnummer.",
      "Mocht u de betaling reeds hebben verricht, dan kunt u deze brief als niet verzonden beschouwen.",
    ],
    afsluiting: [
      "Met vriendelijke groet,",
    ],
  },
  tweede_aanmaning: {
    titel: "TWEEDE AANMANING",
    headerColor: "#ea580c",
    aanhef: "Geachte",
    body: [
      "Ondanks onze eerdere aanmaning hebben wij tot op heden geen betaling ontvangen voor de hieronder vermelde factuur.",
      "Wij verzoeken u met klem het openstaande bedrag binnen 7 dagen te voldoen.",
      "Indien wij binnen deze termijn geen betaling ontvangen, zijn wij genoodzaakt een ingebrekestelling te versturen. Dit kan leiden tot buitengerechtelijke incassokosten die voor uw rekening komen.",
    ],
    afsluiting: [
      "Hoogachtend,",
    ],
  },
  ingebrekestelling: {
    titel: "INGEBREKESTELLING",
    headerColor: "#dc2626",
    aanhef: "Geachte",
    body: [
      "Ondanks herhaaldelijke aanmaningen hebben wij tot op heden geen betaling ontvangen voor de hieronder vermelde factuur. Bij deze stellen wij u formeel in gebreke conform artikel 6:82 van het Burgerlijk Wetboek.",
      "Wij sommeren u het volledige openstaande bedrag binnen 14 dagen na dagtekening van deze brief over te maken op ons rekeningnummer.",
      "Indien u niet binnen de gestelde termijn betaalt, zien wij ons genoodzaakt de vordering uit handen te geven aan een incassobureau. Alle hiermee gepaard gaande kosten, waaronder de buitengerechtelijke incassokosten conform het Besluit vergoeding voor buitengerechtelijke incassokosten, zullen integraal op u worden verhaald.",
      "Daarnaast zal de wettelijke rente over het openstaande bedrag in rekening worden gebracht vanaf de oorspronkelijke vervaldatum.",
    ],
    afsluiting: [
      "Hoogachtend,",
    ],
  },
};

function createAanmaningStyles(t: PdfTheme) {
  return StyleSheet.create({
    page: {
      padding: t.spacing.pagePadding + 10,
      fontSize: t.typography.bodySize,
      fontFamily: t.typography.fontFamily,
      color: t.colors.text,
    },
    headerBar: {
      height: t.header.showColorBar ? t.header.colorBarHeight + 4 : 6,
      marginBottom: t.spacing.sectionGap + 10,
    },
    // Sender info (top right)
    senderSection: {
      marginBottom: t.spacing.sectionGap + 10,
    },
    senderName: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      color: t.colors.primary,
      marginBottom: 4,
    },
    senderDetail: {
      fontSize: t.typography.smallSize,
      color: t.colors.muted,
      lineHeight: 1.4,
    },
    // Recipient
    recipientSection: {
      marginBottom: t.spacing.sectionGap + 10,
    },
    recipientName: {
      fontSize: t.typography.titleSize - 1,
      fontFamily: "Helvetica-Bold",
      marginBottom: 2,
    },
    recipientDetail: {
      fontSize: t.typography.bodySize,
      color: t.colors.text,
      lineHeight: 1.5,
    },
    // Date + reference
    dateSection: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: t.spacing.sectionGap,
    },
    dateText: {
      fontSize: t.typography.smallSize,
      color: t.colors.muted,
    },
    // Title
    title: {
      fontSize: t.typography.headerSize,
      fontFamily: "Helvetica-Bold",
      marginBottom: t.spacing.sectionGap,
    },
    // Body
    bodyText: {
      fontSize: t.typography.bodySize,
      lineHeight: 1.6,
      marginBottom: 12,
      color: t.colors.text,
    },
    // Invoice details box
    detailsBox: {
      borderRadius: 4,
      padding: 16,
      marginVertical: 16,
      border: `1 solid ${t.colors.border}`,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    detailLabel: {
      fontSize: t.typography.smallSize,
      color: t.colors.muted,
    },
    detailValue: {
      fontSize: t.typography.smallSize,
      fontFamily: "Helvetica-Bold",
    },
    detailDivider: {
      borderBottom: `0.5 solid ${t.colors.border}`,
      marginVertical: 8,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingTop: 8,
      borderTop: `1 solid ${t.colors.border}`,
      marginTop: 4,
    },
    totalLabel: {
      fontSize: t.typography.titleSize - 1,
      fontFamily: "Helvetica-Bold",
    },
    totalValue: {
      fontSize: t.typography.titleSize + 1,
      fontFamily: "Helvetica-Bold",
      color: "#dc2626",
    },
    // Payment
    paymentBox: {
      backgroundColor: t.colors.tableAltRowBg,
      borderRadius: 4,
      padding: 12,
      marginVertical: 16,
    },
    paymentTitle: {
      fontSize: t.typography.smallSize,
      fontFamily: "Helvetica-Bold",
      marginBottom: 6,
      color: t.colors.text,
    },
    paymentDetail: {
      fontSize: t.typography.smallSize,
      color: t.colors.text,
      lineHeight: 1.5,
    },
    // Signature
    signatureSection: {
      marginTop: t.spacing.sectionGap + 10,
    },
    signatureText: {
      fontSize: t.typography.bodySize,
      color: t.colors.text,
      lineHeight: 1.6,
    },
    signatureName: {
      fontSize: t.typography.bodySize,
      fontFamily: "Helvetica-Bold",
      marginTop: 4,
    },
    // Footer
    footer: {
      position: "absolute",
      bottom: 30,
      left: t.spacing.pagePadding + 10,
      right: t.spacing.pagePadding + 10,
      borderTop: t.footer.showLine ? `1 solid ${t.colors.border}` : "none",
      paddingTop: 10,
      flexDirection: "row",
      justifyContent: "space-between",
    },
    footerText: {
      fontSize: 7,
      color: t.colors.muted,
    },
  });
}

export function AanmaningPDF({ aanmaning, theme }: AanmaningPDFProps) {
  const t = theme ?? getDefaultTheme();
  const styles = createAanmaningStyles(t);
  const config = typeConfig[aanmaning.type];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Color bar at top */}
        <View style={[styles.headerBar, { backgroundColor: config.headerColor }]} />

        {/* Sender */}
        <View style={styles.senderSection}>
          <Text style={styles.senderName}>{aanmaning.bedrijf.naam}</Text>
          <Text style={styles.senderDetail}>{aanmaning.bedrijf.adres}</Text>
          <Text style={styles.senderDetail}>
            {aanmaning.bedrijf.postcode} {aanmaning.bedrijf.plaats}
          </Text>
          {aanmaning.bedrijf.telefoon && (
            <Text style={styles.senderDetail}>Tel: {aanmaning.bedrijf.telefoon}</Text>
          )}
          {aanmaning.bedrijf.email && (
            <Text style={styles.senderDetail}>E-mail: {aanmaning.bedrijf.email}</Text>
          )}
        </View>

        {/* Recipient */}
        <View style={styles.recipientSection}>
          <Text style={styles.recipientName}>{aanmaning.klant.naam}</Text>
          <Text style={styles.recipientDetail}>{aanmaning.klant.adres}</Text>
          <Text style={styles.recipientDetail}>
            {aanmaning.klant.postcode} {aanmaning.klant.plaats}
          </Text>
        </View>

        {/* Date */}
        <View style={styles.dateSection}>
          <Text style={styles.dateText}>
            {aanmaning.bedrijf.plaats}, {formatDate(aanmaning.datum)}
          </Text>
          <Text style={styles.dateText}>
            Betreft: {aanmaning.factuurNummer}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: config.headerColor }]}>
          {config.titel}
        </Text>

        {/* Aanhef */}
        <Text style={styles.bodyText}>
          {config.aanhef} {aanmaning.klant.naam},
        </Text>

        {/* Body paragraphs */}
        {config.body.map((paragraph, index) => (
          <Text key={index} style={styles.bodyText}>
            {paragraph}
          </Text>
        ))}

        {/* Invoice Details Box */}
        <View style={[styles.detailsBox, { backgroundColor: `${config.headerColor}10` }]}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Factuurnummer</Text>
            <Text style={styles.detailValue}>{aanmaning.factuurNummer}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Factuurdatum</Text>
            <Text style={styles.detailValue}>{formatDate(aanmaning.factuurDatum)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Oorspronkelijke vervaldatum</Text>
            <Text style={styles.detailValue}>{formatDate(aanmaning.vervaldatum)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Aantal dagen verlopen</Text>
            <Text style={[styles.detailValue, { color: "#dc2626" }]}>
              {aanmaning.dagenVervallen} dagen
            </Text>
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Openstaand bedrag</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(aanmaning.totaalInclBtw)}
            </Text>
          </View>
        </View>

        {/* Payment Details */}
        {aanmaning.bedrijf.iban && (
          <View style={styles.paymentBox}>
            <Text style={styles.paymentTitle}>Betaalgegevens</Text>
            <Text style={styles.paymentDetail}>
              IBAN: {aanmaning.bedrijf.iban}
            </Text>
            <Text style={styles.paymentDetail}>
              T.n.v.: {aanmaning.bedrijf.naam}
            </Text>
            <Text style={styles.paymentDetail}>
              Onder vermelding van: {aanmaning.factuurNummer}
            </Text>
          </View>
        )}

        {/* Signature */}
        <View style={styles.signatureSection}>
          {config.afsluiting.map((line, index) => (
            <Text key={index} style={styles.signatureText}>{line}</Text>
          ))}
          <Text style={styles.signatureName}>{aanmaning.bedrijf.naam}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {aanmaning.bedrijf.kvk && `KvK: ${aanmaning.bedrijf.kvk}`}
            {aanmaning.bedrijf.kvk && aanmaning.bedrijf.btw && " | "}
            {aanmaning.bedrijf.btw && `BTW: ${aanmaning.bedrijf.btw}`}
          </Text>
          <Text style={styles.footerText}>
            {aanmaning.bedrijf.iban && `IBAN: ${aanmaning.bedrijf.iban}`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default AanmaningPDF;
