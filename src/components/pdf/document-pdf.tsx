"use client";

/**
 * Eén opmaak voor de overige documenten (HERO-nabouw fase 6):
 * orderbevestiging, bestelformulier en leveringsbon. Zelfde huisstijl als
 * offerte en factuur (logo, kleur), opbouw tekst → regels → tekst.
 * Data: convex/documenten.ts.
 */

import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import {
  createPdfTheme,
  DEFAULT_PDF_PRIMAIRE_KLEUR,
  DEFAULT_PDF_SECUNDAIRE_KLEUR,
  formatCurrency as euro,
  formatDate as datumLang,
  type TemplateStijl,
} from "./pdf-theme";

export interface DocumentPdfData {
  titel: string;
  nummer: string;
  datum: number;
  referentie: string | null;
  ontvanger: { naam: string; adres?: string; postcode?: string; plaats?: string } | null;
  regels: {
    omschrijving: string;
    hoeveelheid: number;
    eenheid: string;
    prijsPerEenheid?: number;
    totaal?: number;
  }[];
  totalen: { exBtw: number; btw: number; inclBtw: number } | null;
  teksten: { inleiding?: string; afsluiting?: string };
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
  } | null;
  branding: {
    logoUrl: string | null;
    primaireKleur: string | null;
    secundaireKleur?: string | null;
    stijl?: TemplateStijl | null;
  };
}

export function DocumentPDF({ data }: { data: DocumentPdfData }) {
  const b = data.bedrijf;
  // Zelfde thema als offerte, contract en factuur (huisstijl okt 2026); een
  // eigen ingestelde kleur of stijl uit Instellingen → Huisstijl wint.
  const t = createPdfTheme(
    {
      logoUrl: data.branding.logoUrl,
      primaireKleur: data.branding.primaireKleur ?? DEFAULT_PDF_PRIMAIRE_KLEUR,
      secundaireKleur: data.branding.secundaireKleur ?? DEFAULT_PDF_SECUNDAIRE_KLEUR,
      bedrijfsnaam: b?.naam ?? "Top Tuinen",
      bedrijfsgegevens: {},
    },
    data.branding.stijl ?? "klassiek",
  );
  const s = t.styles;
  const metPrijzen = data.regels.some((r) => r.totaal !== undefined);
  const col = {
    oms: { flex: 1, paddingRight: 8 },
    aantal: { width: 70, textAlign: "right" as const },
    prijs: { width: 70, textAlign: "right" as const },
    totaal: { width: 80, textAlign: "right" as const },
  };
  // Losse tekstregels: geen s.value (flex: 1 rekt ze in een kolom uit).
  const regel = { fontSize: t.typography.bodySize, lineHeight: 1.4 };

  return (
    <Document title={`${data.titel} ${data.nummer}`}>
      <Page size="A4" style={[s.page, { paddingBottom: t.spacing.pagePadding + 30 }]}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            {data.branding.logoUrl ? (
              <Image src={data.branding.logoUrl} style={s.logo} />
            ) : (
              <View style={s.logoTextContainer}>
                <Text style={s.logoTextTop}>TOP</Text>
                <Text style={s.logoTextTuinen}>TUINEN</Text>
              </View>
            )}
            <View style={s.companyInfo}>
              <Text style={s.companyName}>{b?.naam ?? "Top Tuinen"}</Text>
              {b && (
                <>
                  <Text style={s.companyDetail}>{b.adres}</Text>
                  <Text style={s.companyDetail}>
                    {b.postcode} {b.plaats}
                  </Text>
                  {b.telefoon && <Text style={s.companyDetail}>Tel: {b.telefoon}</Text>}
                  {b.email && <Text style={s.companyDetail}>{b.email}</Text>}
                </>
              )}
            </View>
          </View>
          <View style={s.offerteInfo}>
            <Text style={s.offerteNummer}>{data.titel}</Text>
            <Text style={s.offerteType}>nr. {data.nummer}</Text>
            <Text style={s.offerteDate}>{datumLang(data.datum)}</Text>
          </View>
        </View>

        {data.ontvanger && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{data.titel} voor</Text>
            <Text style={regel}>{data.ontvanger.naam}</Text>
            {data.ontvanger.adres ? <Text style={regel}>{data.ontvanger.adres}</Text> : null}
            {data.ontvanger.plaats ? (
              <Text style={regel}>
                {data.ontvanger.postcode} {data.ontvanger.plaats}
              </Text>
            ) : null}
            {data.referentie && (
              <View style={[s.row, { marginTop: 6 }]}>
                <Text style={s.label}>Betreft:</Text>
                <Text style={s.value}>{data.referentie}</Text>
              </View>
            )}
          </View>
        )}
        {!data.ontvanger && data.referentie && (
          <View style={[s.row, { marginBottom: t.spacing.sectionGap }]}>
            <Text style={s.label}>Betreft:</Text>
            <Text style={s.value}>{data.referentie}</Text>
          </View>
        )}

        {data.teksten.inleiding && (
          <Text style={[regel, { marginBottom: 14, lineHeight: 1.5 }]}>
            {data.teksten.inleiding}
          </Text>
        )}

        <View style={s.table}>
          <View style={s.tableHeader} fixed>
            <Text style={[s.tableHeaderCell, col.oms]}>Omschrijving</Text>
            <Text style={[s.tableHeaderCell, col.aantal]}>Aantal</Text>
            {metPrijzen && <Text style={[s.tableHeaderCell, col.prijs]}>Prijs</Text>}
            {metPrijzen && <Text style={[s.tableHeaderCell, col.totaal]}>Totaal</Text>}
          </View>
          {data.regels.map((r, i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
              <Text style={[s.tableCell, col.oms]}>{r.omschrijving}</Text>
              <Text style={[s.tableCell, col.aantal]}>
                {r.hoeveelheid.toLocaleString("nl-NL")} {r.eenheid}
              </Text>
              {metPrijzen && (
                <Text style={[s.tableCell, col.prijs]}>
                  {r.prijsPerEenheid !== undefined ? euro(r.prijsPerEenheid) : ""}
                </Text>
              )}
              {metPrijzen && (
                <Text style={[s.tableCell, col.totaal]}>
                  {r.totaal !== undefined ? euro(r.totaal) : ""}
                </Text>
              )}
            </View>
          ))}
        </View>

        {data.totalen && (
          <View style={s.totalsSection} wrap={false}>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Totaal excl. btw</Text>
              <Text style={s.totalsValue}>{euro(data.totalen.exBtw)}</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Btw</Text>
              <Text style={s.totalsValue}>{euro(data.totalen.btw)}</Text>
            </View>
            <View style={s.totalsFinalRow}>
              <Text style={s.totalsFinalLabel}>Totaal incl. btw</Text>
              <Text style={s.totalsFinalValue}>{euro(data.totalen.inclBtw)}</Text>
            </View>
          </View>
        )}

        {data.teksten.afsluiting && (
          <Text style={[regel, { marginTop: 18, lineHeight: 1.5 }]}>
            {data.teksten.afsluiting}
          </Text>
        )}

        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${data.titel} ${data.nummer} | ${b?.naam ?? "Top Tuinen"}${b?.kvk ? ` | KvK ${b.kvk}` : ""}${b?.btw ? ` | Btw ${b.btw}` : ""} | Bladzijde ${pageNumber}/${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
