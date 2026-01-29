"use client";

import {
  Document,
  Page,
  Text,
  View,
} from "@react-pdf/renderer";
import { styles, formatCurrency, formatDate } from "./pdf-styles";
import type { Bedrijfsgegevens } from "@/types/offerte";

// Define offerte type inline to avoid import issues with Convex
interface OfferteRegel {
  id: string;
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  totaal: number;
  type: "materiaal" | "arbeid" | "machine";
}

interface OfferteTotalen {
  materiaalkosten: number;
  arbeidskosten: number;
  totaalUren: number;
  subtotaal: number;
  marge: number;
  margePercentage: number;
  totaalExBtw: number;
  btw: number;
  totaalInclBtw: number;
}

interface Offerte {
  offerteNummer: string;
  type: "aanleg" | "onderhoud";
  status: string;
  klant: {
    naam: string;
    adres: string;
    postcode: string;
    plaats: string;
    email?: string;
    telefoon?: string;
  };
  algemeenParams: {
    bereikbaarheid: string;
    achterstalligheid?: string;
  };
  scopes?: string[];
  scopeData?: Record<string, unknown>;
  regels: OfferteRegel[];
  totalen: OfferteTotalen;
  notities?: string;
  createdAt: number;
  updatedAt: number;
}

interface OffertePDFProps {
  offerte: Offerte;
  bedrijfsgegevens?: Bedrijfsgegevens;
}

const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders & Beplanting",
  gras: "Gras / Gazon",
  houtwerk: "Houtwerk",
  water_elektra: "Water / Elektra",
  specials: "Specials",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

const bereikbaarheidLabels: Record<string, string> = {
  goed: "Goed",
  beperkt: "Beperkt",
  slecht: "Slecht",
};

export function OffertePDF({ offerte, bedrijfsgegevens }: OffertePDFProps) {
  const companyName = bedrijfsgegevens?.naam || "Top Tuinen";
  const companyAddress = bedrijfsgegevens
    ? `${bedrijfsgegevens.adres}, ${bedrijfsgegevens.postcode} ${bedrijfsgegevens.plaats}`
    : "";

  // Group regels by type
  const materiaalRegels = offerte.regels.filter((r) => r.type === "materiaal");
  const arbeidsRegels = offerte.regels.filter((r) => r.type === "arbeid");
  const machineRegels = offerte.regels.filter((r) => r.type === "machine");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{companyName}</Text>
            {companyAddress && (
              <Text style={styles.companyDetail}>{companyAddress}</Text>
            )}
            {bedrijfsgegevens?.telefoon && (
              <Text style={styles.companyDetail}>
                Tel: {bedrijfsgegevens.telefoon}
              </Text>
            )}
            {bedrijfsgegevens?.email && (
              <Text style={styles.companyDetail}>{bedrijfsgegevens.email}</Text>
            )}
            {bedrijfsgegevens?.kvk && (
              <Text style={styles.companyDetail}>
                KvK: {bedrijfsgegevens.kvk}
              </Text>
            )}
          </View>
          <View style={styles.offerteInfo}>
            <Text style={styles.offerteNummer}>{offerte.offerteNummer}</Text>
            <Text style={styles.offerteType}>
              {offerte.type === "aanleg" ? "Aanlegofferte" : "Onderhoudsofferte"}
            </Text>
            <Text style={styles.offerteDate}>
              {formatDate(offerte.createdAt)}
            </Text>
          </View>
        </View>

        {/* Klantgegevens */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Klantgegevens</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Naam:</Text>
            <Text style={styles.value}>{offerte.klant.naam}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Adres:</Text>
            <Text style={styles.value}>
              {offerte.klant.adres}, {offerte.klant.postcode}{" "}
              {offerte.klant.plaats}
            </Text>
          </View>
          {offerte.klant.telefoon && (
            <View style={styles.row}>
              <Text style={styles.label}>Telefoon:</Text>
              <Text style={styles.value}>{offerte.klant.telefoon}</Text>
            </View>
          )}
          {offerte.klant.email && (
            <View style={styles.row}>
              <Text style={styles.label}>E-mail:</Text>
              <Text style={styles.value}>{offerte.klant.email}</Text>
            </View>
          )}
        </View>

        {/* Project informatie */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Informatie</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Bereikbaarheid:</Text>
            <Text style={styles.value}>
              {bereikbaarheidLabels[offerte.algemeenParams.bereikbaarheid] ||
                offerte.algemeenParams.bereikbaarheid}
            </Text>
          </View>
          {offerte.algemeenParams.achterstalligheid && (
            <View style={styles.row}>
              <Text style={styles.label}>Achterstalligheid:</Text>
              <Text style={styles.value}>
                {offerte.algemeenParams.achterstalligheid}
              </Text>
            </View>
          )}
          {offerte.scopes && offerte.scopes.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Werkzaamheden:</Text>
              <Text style={styles.value}>
                {offerte.scopes
                  .map((s) => scopeLabels[s] || s)
                  .join(", ")}
              </Text>
            </View>
          )}
        </View>

        {/* Offerteregels - Materialen */}
        {materiaalRegels.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Materialen</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colDescription]}>
                  Omschrijving
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colScope]}>
                  Scope
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colQuantity]}>
                  Hoeveelheid
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colPrice]}>
                  Prijs/eenheid
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colTotal]}>
                  Totaal
                </Text>
              </View>
              {materiaalRegels.map((regel, index) => (
                <View
                  key={regel.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={[styles.tableCell, styles.colDescription]}>
                    {regel.omschrijving}
                  </Text>
                  <Text style={[styles.tableCell, styles.colScope]}>
                    {scopeLabels[regel.scope] || regel.scope}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colQuantity]}>
                    {regel.hoeveelheid} {regel.eenheid}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colPrice]}>
                    {formatCurrency(regel.prijsPerEenheid)}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colTotal]}>
                    {formatCurrency(regel.totaal)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Offerteregels - Arbeid */}
        {arbeidsRegels.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Arbeid</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colDescription]}>
                  Omschrijving
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colScope]}>
                  Scope
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colQuantity]}>
                  Uren
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colPrice]}>
                  Uurtarief
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colTotal]}>
                  Totaal
                </Text>
              </View>
              {arbeidsRegels.map((regel, index) => (
                <View
                  key={regel.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={[styles.tableCell, styles.colDescription]}>
                    {regel.omschrijving}
                  </Text>
                  <Text style={[styles.tableCell, styles.colScope]}>
                    {scopeLabels[regel.scope] || regel.scope}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colQuantity]}>
                    {regel.hoeveelheid} {regel.eenheid}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colPrice]}>
                    {formatCurrency(regel.prijsPerEenheid)}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colTotal]}>
                    {formatCurrency(regel.totaal)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Offerteregels - Machine */}
        {machineRegels.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Machines & Materieel</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.colDescription]}>
                  Omschrijving
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colScope]}>
                  Scope
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colQuantity]}>
                  Hoeveelheid
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colPrice]}>
                  Prijs/eenheid
                </Text>
                <Text style={[styles.tableHeaderCell, styles.colTotal]}>
                  Totaal
                </Text>
              </View>
              {machineRegels.map((regel, index) => (
                <View
                  key={regel.id}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={[styles.tableCell, styles.colDescription]}>
                    {regel.omschrijving}
                  </Text>
                  <Text style={[styles.tableCell, styles.colScope]}>
                    {scopeLabels[regel.scope] || regel.scope}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colQuantity]}>
                    {regel.hoeveelheid} {regel.eenheid}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colPrice]}>
                    {formatCurrency(regel.prijsPerEenheid)}
                  </Text>
                  <Text style={[styles.tableCellRight, styles.colTotal]}>
                    {formatCurrency(regel.totaal)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Totalen */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Materiaalkosten:</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(offerte.totalen.materiaalkosten)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              Arbeidskosten ({offerte.totalen.totaalUren} uur):
            </Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(offerte.totalen.arbeidskosten)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotaal:</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(offerte.totalen.subtotaal)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              Marge ({offerte.totalen.margePercentage}%):
            </Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(offerte.totalen.marge)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Totaal excl. BTW:</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(offerte.totalen.totaalExBtw)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>BTW (21%):</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(offerte.totalen.btw)}
            </Text>
          </View>
          <View style={styles.totalsFinalRow}>
            <Text style={styles.totalsFinalLabel}>Totaal incl. BTW:</Text>
            <Text style={styles.totalsFinalValue}>
              {formatCurrency(offerte.totalen.totaalInclBtw)}
            </Text>
          </View>
        </View>

        {/* Notities */}
        {offerte.notities && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Opmerkingen</Text>
            <Text style={styles.notesText}>{offerte.notities}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>
            {companyName}
            {bedrijfsgegevens?.kvk && ` • KvK: ${bedrijfsgegevens.kvk}`}
            {bedrijfsgegevens?.btw && ` • BTW: ${bedrijfsgegevens.btw}`}
            {bedrijfsgegevens?.iban && ` • IBAN: ${bedrijfsgegevens.iban}`}
          </Text>
          <Text>
            Deze offerte is geldig tot 30 dagen na dagtekening.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
