"use client";

import {
  Document,
  Image,
  Page,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "./pdf-theme";
import { getDefaultTheme } from "./pdf-theme";
import type { PdfTheme } from "./pdf-theme";

// ── Types ────────────────────────────────────────────────────────────

interface ContractLocatie {
  adres: string;
  postcode: string;
  plaats: string;
  notities?: string;
}

interface ContractData {
  _id: string;
  contractNummer: string;
  naam: string;
  status: string;
  locatie: ContractLocatie;
  startDatum: string;
  eindDatum: string;
  opzegtermijnDagen: number;
  tariefPerTermijn: number;
  betalingsfrequentie: string;
  jaarlijksTarief: number;
  indexatiePercentage?: number;
  autoVerlenging: boolean;
  verlengingsPeriodeInMaanden?: number;
  notities?: string;
  voorwaarden?: string;
  createdAt: number;
}

interface KlantData {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  telefoon?: string;
}

interface Werkzaamheid {
  _id: string;
  omschrijving: string;
  seizoen: string;
  frequentie: number;
  frequentieEenheid?: string;
  geschatteUrenPerBeurt: number;
  geschatteUrenTotaal: number;
  volgorde: number;
}

interface ContractFactuur {
  _id: string;
  termijnNummer: number;
  periodeStart: string;
  periodeEinde: string;
  bedrag: number;
  status: string;
}

type WerkzaamhedenPerSeizoen = Record<string, Werkzaamheid[]>;

interface ContractPdfProps {
  contract: ContractData;
  klant: KlantData | null;
  werkzaamhedenPerSeizoen: WerkzaamhedenPerSeizoen;
  facturen?: ContractFactuur[];
  theme?: PdfTheme;
  voorwaarden?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const seizoenLabels: Record<string, string> = {
  voorjaar: "Voorjaar (Mrt - Mei)",
  zomer: "Zomer (Jun - Aug)",
  herfst: "Herfst (Sep - Nov)",
  winter: "Winter (Dec - Feb)",
};

const seizoenOrder = ["voorjaar", "zomer", "herfst", "winter"];

const frequentieLabels: Record<string, string> = {
  maandelijks: "Maandelijks",
  per_kwartaal: "Per kwartaal",
  halfjaarlijks: "Halfjaarlijks",
  jaarlijks: "Jaarlijks",
};

const frequentieEenheidLabels: Record<string, string> = {
  per_seizoen: "per seizoen",
  per_maand: "per maand",
  per_week: "per week",
};

function formatDateString(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const DEFAULT_VOORWAARDEN = `1. Dit onderhoudscontract wordt aangegaan voor de in het contract vermelde looptijd.
2. Het contract wordt, tenzij anders overeengekomen, stilzwijgend verlengd na afloop van de contractperiode.
3. Opzegging dient schriftelijk te geschieden met inachtneming van de overeengekomen opzegtermijn.
4. Alle genoemde bedragen zijn exclusief BTW, tenzij anders vermeld.
5. Prijswijzigingen worden jaarlijks doorgevoerd conform het overeengekomen indexatiepercentage.
6. Top Tuinen behoudt zich het recht voor om werkzaamheden uit te stellen bij extreme weersomstandigheden.
7. Op dit contract zijn de Algemene Voorwaarden van Top Tuinen van toepassing.`;

// ── Component ────────────────────────────────────────────────────────

export function ContractPDF({
  contract,
  klant,
  werkzaamhedenPerSeizoen,
  facturen,
  theme,
  voorwaarden,
}: ContractPdfProps) {
  const t = theme ?? getDefaultTheme();
  const s = t.styles;
  const branding = t.branding;

  // Determine if CONCEPT watermark should be shown
  const showConceptWatermark = contract.status === "concept";

  // Resolve logo source
  const logoSrc = branding.logoUrl || null;

  // Build company address
  const companyAddress = branding.bedrijfsgegevens.adres || "";

  // BTW calculation
  const btwPercentage = 21;
  const subtotaalExBtw = contract.jaarlijksTarief;
  const btwBedrag = subtotaalExBtw * (btwPercentage / 100);
  const totaalInclBtw = subtotaalExBtw + btwBedrag;

  // Determine which voorwaarden text to use
  const voorwaardenText =
    voorwaarden ?? contract.voorwaarden ?? DEFAULT_VOORWAARDEN;

  // Get seizoenen with werkzaamheden, in order
  const actieveSeizoen = seizoenOrder.filter(
    (s) =>
      werkzaamhedenPerSeizoen[s] && werkzaamhedenPerSeizoen[s].length > 0
  );

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* CONCEPT Watermark */}
        {showConceptWatermark && (
          <Text style={s.watermark} fixed>
            CONCEPT
          </Text>
        )}

        {/* ── 1. Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            {logoSrc ? (
              <Image style={s.logo} src={logoSrc} />
            ) : (
              <View style={s.logoTextContainer}>
                <Text style={s.logoTextTop}>TOP</Text>
                <Text style={s.logoTextTuinen}>TUINEN</Text>
              </View>
            )}
            <View style={s.companyInfo}>
              <Text style={s.companyName}>{branding.bedrijfsnaam}</Text>
              {companyAddress && (
                <Text style={s.companyDetail}>{companyAddress}</Text>
              )}
              {branding.bedrijfsgegevens.telefoon && (
                <Text style={s.companyDetail}>
                  Tel: {branding.bedrijfsgegevens.telefoon}
                </Text>
              )}
              {branding.bedrijfsgegevens.email && (
                <Text style={s.companyDetail}>
                  {branding.bedrijfsgegevens.email}
                </Text>
              )}
              {branding.bedrijfsgegevens.kvkNummer && (
                <Text style={s.companyDetail}>
                  KvK: {branding.bedrijfsgegevens.kvkNummer}
                </Text>
              )}
            </View>
          </View>
          <View style={s.offerteInfo}>
            <Text style={s.offerteNummer}>{contract.contractNummer}</Text>
            <Text style={s.offerteType}>Onderhoudscontract</Text>
            <Text style={s.offerteDate}>{formatDate(contract.createdAt)}</Text>
          </View>
        </View>

        {/* ── 2. Klantgegevens ──────────────────────────────────── */}
        {klant && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Klantgegevens</Text>
            <View style={s.row}>
              <Text style={s.label}>Naam:</Text>
              <Text style={s.value}>{klant.naam}</Text>
            </View>
            <View style={s.row}>
              <Text style={s.label}>Adres:</Text>
              <Text style={s.value}>
                {klant.adres}, {klant.postcode} {klant.plaats}
              </Text>
            </View>
            {klant.telefoon && (
              <View style={s.row}>
                <Text style={s.label}>Telefoon:</Text>
                <Text style={s.value}>{klant.telefoon}</Text>
              </View>
            )}
            {klant.email && (
              <View style={s.row}>
                <Text style={s.label}>E-mail:</Text>
                <Text style={s.value}>{klant.email}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── 3. Contractdetails ────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contractdetails</Text>
          <View style={s.row}>
            <Text style={s.label}>Contractnr:</Text>
            <Text style={s.value}>{contract.contractNummer}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Looptijd:</Text>
            <Text style={s.value}>
              {formatDateString(contract.startDatum)} t/m{" "}
              {formatDateString(contract.eindDatum)}
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Werklocatie:</Text>
            <Text style={s.value}>
              {contract.locatie.adres}, {contract.locatie.postcode}{" "}
              {contract.locatie.plaats}
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Betaling:</Text>
            <Text style={s.value}>
              {frequentieLabels[contract.betalingsfrequentie] ??
                contract.betalingsfrequentie}
            </Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Opzegtermijn:</Text>
            <Text style={s.value}>{contract.opzegtermijnDagen} dagen</Text>
          </View>
          {contract.autoVerlenging && (
            <View style={s.row}>
              <Text style={s.label}>Verlenging:</Text>
              <Text style={s.value}>
                Automatisch
                {contract.verlengingsPeriodeInMaanden
                  ? ` (${contract.verlengingsPeriodeInMaanden} maanden)`
                  : ""}
              </Text>
            </View>
          )}
          {contract.indexatiePercentage != null &&
            contract.indexatiePercentage > 0 && (
              <View style={s.row}>
                <Text style={s.label}>Indexatie:</Text>
                <Text style={s.value}>
                  {contract.indexatiePercentage}% per jaar
                </Text>
              </View>
            )}
        </View>

        {/* ── 4. Werkzaamheden per seizoen ──────────────────────── */}
        {actieveSeizoen.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Werkzaamheden</Text>
            {actieveSeizoen.map((seizoen) => {
              const items = werkzaamhedenPerSeizoen[seizoen];
              return (
                <View key={seizoen} style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      fontSize: t.typography.bodySize,
                      fontFamily: "Helvetica-Bold",
                      marginBottom: 6,
                      color: t.colors.text,
                    }}
                  >
                    {seizoenLabels[seizoen] ?? seizoen}
                  </Text>
                  <View style={s.table}>
                    <View style={s.tableHeader}>
                      <Text style={[s.tableHeaderCell, { flex: 4 }]}>
                        Omschrijving
                      </Text>
                      <Text
                        style={[
                          s.tableHeaderCell,
                          { flex: 2, textAlign: "right" },
                        ]}
                      >
                        Frequentie
                      </Text>
                      <Text
                        style={[
                          s.tableHeaderCell,
                          { flex: 2, textAlign: "right" },
                        ]}
                      >
                        Uren/beurt
                      </Text>
                      <Text
                        style={[
                          s.tableHeaderCell,
                          { flex: 2, textAlign: "right" },
                        ]}
                      >
                        Totaal uren
                      </Text>
                    </View>
                    {items.map((w, index) => (
                      <View
                        key={w._id}
                        style={index % 2 === 0 ? s.tableRow : s.tableRowAlt}
                      >
                        <Text style={[s.tableCell, { flex: 4 }]}>
                          {w.omschrijving}
                        </Text>
                        <Text style={[s.tableCellRight, { flex: 2 }]}>
                          {w.frequentie}x{" "}
                          {w.frequentieEenheid
                            ? frequentieEenheidLabels[w.frequentieEenheid] ??
                              w.frequentieEenheid
                            : "per seizoen"}
                        </Text>
                        <Text style={[s.tableCellRight, { flex: 2 }]}>
                          {w.geschatteUrenPerBeurt}
                        </Text>
                        <Text style={[s.tableCellRight, { flex: 2 }]}>
                          {w.geschatteUrenTotaal}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── 5. Prijsoverzicht ─────────────────────────────────── */}
        <View style={s.totalsSection}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Jaarlijks tarief excl. BTW:</Text>
            <Text style={s.totalsValue}>
              {formatCurrency(subtotaalExBtw)}
            </Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>BTW ({btwPercentage}%):</Text>
            <Text style={s.totalsValue}>{formatCurrency(btwBedrag)}</Text>
          </View>
          <View style={s.totalsFinalRow}>
            <Text style={s.totalsFinalLabel}>Totaal incl. BTW (per jaar):</Text>
            <Text style={s.totalsFinalValue}>
              {formatCurrency(totaalInclBtw)}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <Text
              style={{
                width: 250,
                fontSize: t.typography.smallSize,
                color: t.colors.muted,
                textAlign: "right",
              }}
            >
              ({formatCurrency(contract.tariefPerTermijn)} per termijn,{" "}
              {frequentieLabels[contract.betalingsfrequentie]?.toLowerCase() ??
                contract.betalingsfrequentie}
              )
            </Text>
          </View>
        </View>

        {/* ── 6. Betalingsvoorwaarden ───────────────────────────── */}
        {facturen && facturen.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Factureringsschema</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { flex: 1 }]}>Termijn</Text>
                <Text style={[s.tableHeaderCell, { flex: 3 }]}>Periode</Text>
                <Text
                  style={[
                    s.tableHeaderCell,
                    { flex: 2, textAlign: "right" },
                  ]}
                >
                  Bedrag excl. BTW
                </Text>
              </View>
              {facturen.map((f, index) => (
                <View
                  key={f._id}
                  style={index % 2 === 0 ? s.tableRow : s.tableRowAlt}
                >
                  <Text style={[s.tableCell, { flex: 1 }]}>
                    {f.termijnNummer}
                  </Text>
                  <Text style={[s.tableCell, { flex: 3 }]}>
                    {formatDateShort(f.periodeStart)} -{" "}
                    {formatDateShort(f.periodeEinde)}
                  </Text>
                  <Text style={[s.tableCellRight, { flex: 2 }]}>
                    {formatCurrency(f.bedrag)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 7. Voorwaarden ────────────────────────────────────── */}
        <View style={s.notesSection}>
          <Text style={s.notesTitle}>Voorwaarden</Text>
          <Text style={s.notesText}>{voorwaardenText}</Text>
        </View>

        {/* ── 8. Handtekeningblok ───────────────────────────────── */}
        <View
          style={{
            marginTop: t.spacing.sectionGap,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          {/* Linkerkolom: Top Tuinen */}
          <View style={{ flex: 1, paddingRight: 20 }}>
            <Text
              style={{
                fontSize: t.typography.bodySize,
                fontFamily: "Helvetica-Bold",
                marginBottom: 16,
                color: t.colors.text,
              }}
            >
              {branding.bedrijfsnaam}
            </Text>
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: t.typography.smallSize,
                  color: t.colors.muted,
                  marginBottom: 4,
                }}
              >
                Datum:
              </Text>
              <View
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.border,
                  height: 20,
                }}
              />
            </View>
            <View>
              <Text
                style={{
                  fontSize: t.typography.smallSize,
                  color: t.colors.muted,
                  marginBottom: 4,
                }}
              >
                Handtekening:
              </Text>
              <View
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.border,
                  height: 40,
                }}
              />
            </View>
          </View>

          {/* Rechterkolom: Klant */}
          <View style={{ flex: 1, paddingLeft: 20 }}>
            <Text
              style={{
                fontSize: t.typography.bodySize,
                fontFamily: "Helvetica-Bold",
                marginBottom: 16,
                color: t.colors.text,
              }}
            >
              {klant?.naam ?? "Opdrachtgever"}
            </Text>
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: t.typography.smallSize,
                  color: t.colors.muted,
                  marginBottom: 4,
                }}
              >
                Datum:
              </Text>
              <View
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.border,
                  height: 20,
                }}
              />
            </View>
            <View>
              <Text
                style={{
                  fontSize: t.typography.smallSize,
                  color: t.colors.muted,
                  marginBottom: 4,
                }}
              >
                Handtekening:
              </Text>
              <View
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.border,
                  height: 40,
                }}
              />
            </View>
          </View>
        </View>

        {/* ── 9. Footer ─────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <Text>
            {branding.bedrijfsnaam}
            {branding.bedrijfsgegevens.kvkNummer &&
              ` \u2022 KvK: ${branding.bedrijfsgegevens.kvkNummer}`}
            {branding.bedrijfsgegevens.btwNummer &&
              ` \u2022 BTW: ${branding.bedrijfsgegevens.btwNummer}`}
            {branding.bedrijfsgegevens.iban &&
              ` \u2022 IBAN: ${branding.bedrijfsgegevens.iban}`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default ContractPDF;
