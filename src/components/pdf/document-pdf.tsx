"use client";

/**
 * Eén opmaak voor de overige documenten (HERO-nabouw fase 6):
 * orderbevestiging, bestelformulier en leveringsbon. Zelfde huisstijl als
 * offerte en factuur (logo, kleur), opbouw tekst → regels → tekst.
 * Data: convex/documenten.ts.
 */

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

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
  branding: { logoUrl: string | null; primaireKleur: string | null };
}

const euro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
const datumLang = (ms: number) =>
  new Date(ms).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

export function DocumentPDF({ data }: { data: DocumentPdfData }) {
  const kleur = data.branding.primaireKleur ?? "#16a34a";
  const metPrijzen = data.regels.some((r) => r.totaal !== undefined);
  const s = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
    kop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
    logo: { height: 40, objectFit: "contain" },
    bedrijfNaam: { fontSize: 14, fontFamily: "Helvetica-Bold", color: kleur },
    klein: { fontSize: 8, color: "#6b7280" },
    adres: { marginBottom: 16, lineHeight: 1.4 },
    titel: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    info: { flexDirection: "row", gap: 24, marginBottom: 16 },
    tekst: { marginBottom: 14, lineHeight: 1.5 },
    tabelKop: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: kleur,
      paddingBottom: 4,
      marginBottom: 4,
      fontFamily: "Helvetica-Bold",
    },
    rij: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
    oms: { flex: 1, paddingRight: 8 },
    aantal: { width: 70, textAlign: "right" },
    prijs: { width: 70, textAlign: "right" },
    totaal: { width: 80, textAlign: "right" },
    totalen: { marginTop: 8, marginLeft: "auto", width: 220 },
    totaalRij: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
    vet: { fontFamily: "Helvetica-Bold" },
    voet: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7, color: "#6b7280", textAlign: "center" },
  });
  const b = data.bedrijf;

  return (
    <Document title={`${data.titel} ${data.nummer}`}>
      <Page size="A4" style={s.page}>
        <View style={s.kop}>
          <View>
            {data.branding.logoUrl ? <Image src={data.branding.logoUrl} style={s.logo} /> : (
              <Text style={s.bedrijfNaam}>{b?.naam ?? "Top Tuinen"}</Text>
            )}
          </View>
          {b && (
            <View>
              <Text style={s.klein}>{b.naam}</Text>
              <Text style={s.klein}>{b.adres}</Text>
              <Text style={s.klein}>
                {b.postcode} {b.plaats}
              </Text>
              {b.telefoon && <Text style={s.klein}>{b.telefoon}</Text>}
              {b.email && <Text style={s.klein}>{b.email}</Text>}
            </View>
          )}
        </View>

        {data.ontvanger && (
          <View style={s.adres}>
            <Text>{data.ontvanger.naam}</Text>
            {data.ontvanger.adres ? <Text>{data.ontvanger.adres}</Text> : null}
            {data.ontvanger.plaats ? (
              <Text>
                {data.ontvanger.postcode} {data.ontvanger.plaats}
              </Text>
            ) : null}
          </View>
        )}

        <Text style={s.titel}>
          {data.titel} nr. {data.nummer}
        </Text>
        <View style={s.info}>
          <Text>Datum: {datumLang(data.datum)}</Text>
          {data.referentie && <Text>Betreft: {data.referentie}</Text>}
        </View>

        {data.teksten.inleiding && <Text style={s.tekst}>{data.teksten.inleiding}</Text>}

        <View style={s.tabelKop}>
          <Text style={s.oms}>Omschrijving</Text>
          <Text style={s.aantal}>Aantal</Text>
          {metPrijzen && <Text style={s.prijs}>Prijs</Text>}
          {metPrijzen && <Text style={s.totaal}>Totaal</Text>}
        </View>
        {data.regels.map((r, i) => (
          <View key={i} style={s.rij} wrap={false}>
            <Text style={s.oms}>{r.omschrijving}</Text>
            <Text style={s.aantal}>
              {r.hoeveelheid.toLocaleString("nl-NL")} {r.eenheid}
            </Text>
            {metPrijzen && <Text style={s.prijs}>{r.prijsPerEenheid !== undefined ? euro(r.prijsPerEenheid) : ""}</Text>}
            {metPrijzen && <Text style={s.totaal}>{r.totaal !== undefined ? euro(r.totaal) : ""}</Text>}
          </View>
        ))}

        {data.totalen && (
          <View style={s.totalen}>
            <View style={s.totaalRij}>
              <Text>Totaal excl. btw</Text>
              <Text>{euro(data.totalen.exBtw)}</Text>
            </View>
            <View style={s.totaalRij}>
              <Text>Btw</Text>
              <Text>{euro(data.totalen.btw)}</Text>
            </View>
            <View style={s.totaalRij}>
              <Text style={s.vet}>Totaal incl. btw</Text>
              <Text style={s.vet}>{euro(data.totalen.inclBtw)}</Text>
            </View>
          </View>
        )}

        {data.teksten.afsluiting && (
          <Text style={[s.tekst, { marginTop: 18 }]}>{data.teksten.afsluiting}</Text>
        )}

        <Text
          style={s.voet}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${data.titel} ${data.nummer} | ${b?.naam ?? ""}${b?.kvk ? ` | KvK ${b.kvk}` : ""}${b?.btw ? ` | Btw ${b.btw}` : ""} | Bladzijde ${pageNumber}/${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
