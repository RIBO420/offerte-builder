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

// Customer-friendly summary with visible line items
interface ScopeLineItem {
  omschrijving: string;
  hoeveelheid?: number;
  eenheid?: string;
}

interface ScopeSummary {
  scope: string;
  scopeLabel: string;
  totaal: number;
  visibleItems: ScopeLineItem[]; // Items to show with quantities
  hasHiddenItems: boolean; // True if there are hidden kleinmateriaal/arbeid items
}

// Units that should always be shown with quantities
const visibleUnits = ['m²', 'm2', 'm³', 'm3', 'm', 'stuks', 'st'];

// Keywords for major materials that should be shown
const majorMaterialKeywords = [
  'tegel', 'tegels', 'klinker', 'klinkers', 'natuursteen',
  'schutting', 'scherm', 'vlonder', 'pergola', 'overkapping',
  'graszoden', 'graszod', 'gazon',
  'plant', 'planten', 'boom', 'bomen', 'heester', 'heesters', 'haag', 'heg',
  'zand', 'grond', 'grind', 'split', 'compost', 'tuinaarde',
  'opsluitband', 'opsluitbanden', 'kantopsluiting',
  'vijver', 'waterpartij', 'fontein',
  'verlichting', 'lamp', 'armatuur',
];

// Keywords for small materials that should be hidden (grouped as kleinmateriaal)
const kleinmateriaalKeywords = [
  'kabel', 'kabels', 'draad', 'snoer',
  'stopcontact', 'schakelaar', 'fitting', 'dimmer',
  'buis', 'buizen', 'pvc', 'leiding',
  'schroef', 'schroeven', 'bout', 'bouten', 'moer', 'moeren',
  'spijker', 'spijkers', 'nagel', 'nagels',
  'kit', 'lijm', 'tape',
  'koppeling', 'connector', 'aansluiting',
  'kleinmateriaal', 'bevestiging', 'bevestigingsmateriaal',
];

function shouldShowItem(regel: OfferteRegel): boolean {
  const omschrijvingLower = regel.omschrijving.toLowerCase();
  const eenheidLower = regel.eenheid.toLowerCase();

  // Always hide labor items
  if (regel.type === 'arbeid' || omschrijvingLower.startsWith('arbeid')) {
    return false;
  }

  // Show items with area/volume/length units
  if (visibleUnits.some(unit => eenheidLower.includes(unit.toLowerCase()))) {
    return true;
  }

  // Check if it's kleinmateriaal (hide these)
  if (kleinmateriaalKeywords.some(kw => omschrijvingLower.includes(kw))) {
    return false;
  }

  // Check if it's a major material (show these)
  if (majorMaterialKeywords.some(kw => omschrijvingLower.includes(kw))) {
    return true;
  }

  // Default: hide other small items
  return false;
}

function summarizeRegelsByScope(regels: OfferteRegel[]): ScopeSummary[] {
  const scopeMap = new Map<string, ScopeSummary>();

  for (const regel of regels) {
    const existing = scopeMap.get(regel.scope);
    const isVisible = shouldShowItem(regel);

    const lineItem: ScopeLineItem | null = isVisible ? {
      omschrijving: regel.omschrijving,
      hoeveelheid: regel.hoeveelheid,
      eenheid: regel.eenheid,
    } : null;

    if (existing) {
      existing.totaal += regel.totaal;
      if (lineItem && !existing.visibleItems.some(item =>
        item.omschrijving === lineItem.omschrijving && item.hoeveelheid === lineItem.hoeveelheid
      )) {
        existing.visibleItems.push(lineItem);
      }
      if (!isVisible) {
        existing.hasHiddenItems = true;
      }
    } else {
      scopeMap.set(regel.scope, {
        scope: regel.scope,
        scopeLabel: scopeLabels[regel.scope] || regel.scope,
        totaal: regel.totaal,
        visibleItems: lineItem ? [lineItem] : [],
        hasHiddenItems: !isVisible,
      });
    }
  }

  // Sort by scope order and return
  const scopeOrder = ['grondwerk', 'bestrating', 'borders', 'gras', 'houtwerk', 'water_elektra', 'specials', 'heggen', 'bomen', 'overig'];
  return Array.from(scopeMap.values()).sort((a, b) => {
    const aIndex = scopeOrder.indexOf(a.scope);
    const bIndex = scopeOrder.indexOf(b.scope);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
}

function formatLineItems(summary: ScopeSummary): string {
  const parts: string[] = [];

  // Add visible items with quantities
  for (const item of summary.visibleItems.slice(0, 4)) {
    if (item.hoeveelheid && item.eenheid) {
      parts.push(`${item.hoeveelheid} ${item.eenheid} ${item.omschrijving}`);
    } else {
      parts.push(item.omschrijving);
    }
  }

  if (summary.visibleItems.length > 4) {
    parts.push('e.a.');
  }

  // Add note about hidden items
  if (summary.hasHiddenItems && parts.length > 0) {
    parts.push('incl. kleinmateriaal en arbeid');
  } else if (summary.hasHiddenItems) {
    return 'Inclusief materiaal en arbeid';
  }

  return parts.length > 0 ? parts.join(', ') : 'Inclusief materiaal en arbeid';
}

export function OffertePDF({ offerte, bedrijfsgegevens }: OffertePDFProps) {
  const companyName = bedrijfsgegevens?.naam || "Top Tuinen";
  const companyAddress = bedrijfsgegevens
    ? `${bedrijfsgegevens.adres}, ${bedrijfsgegevens.postcode} ${bedrijfsgegevens.plaats}`
    : "";

  // Summarize regels by scope for customer-friendly view
  const scopeSummaries = summarizeRegelsByScope(offerte.regels);

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

        {/* Werkzaamheden - Customer-friendly summarized view */}
        {scopeSummaries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Werkzaamheden</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>
                  Onderdeel
                </Text>
                <Text style={[styles.tableHeaderCell, { flex: 4 }]}>
                  Omschrijving
                </Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
                  Bedrag
                </Text>
              </View>
              {scopeSummaries.map((summary, index) => (
                <View
                  key={summary.scope}
                  style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={[styles.tableCell, { flex: 2, fontWeight: 600 }]}>
                    {summary.scopeLabel}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 4, fontSize: 9, color: "#666" }]}>
                    {formatLineItems(summary)}
                  </Text>
                  <Text style={[styles.tableCellRight, { flex: 1 }]}>
                    {formatCurrency(summary.totaal)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Totalen - Customer-friendly view (no internal costs breakdown) */}
        <View style={styles.totalsSection}>
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
