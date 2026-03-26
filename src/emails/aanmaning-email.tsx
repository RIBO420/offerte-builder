import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

interface AanmaningEmailProps {
  klantNaam: string;
  factuurNummer: string;
  factuurDatum: string;
  vervaldatum: string;
  dagenTeVerlopen: number;
  totaalInclBtw: number;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  iban: string;
  bic?: string;
  kvkNummer?: string;
  btwNummer?: string;
  type: "eerste_aanmaning" | "tweede_aanmaning" | "ingebrekestelling";
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

const typeConfig = {
  eerste_aanmaning: {
    titel: "1e Aanmaning",
    preview: "Eerste aanmaning",
    intro:
      "Ondanks onze eerdere herinnering hebben wij nog geen betaling ontvangen voor onderstaande factuur. Wij verzoeken u vriendelijk om het openstaande bedrag zo spoedig mogelijk te voldoen.",
    afsluiting:
      "Mocht u de betaling inmiddels hebben voldaan, dan kunt u dit schrijven als niet verzonden beschouwen. Bij vragen kunt u uiteraard contact met ons opnemen.",
    headerColor: "#f59e0b", // amber
    boxBg: "#fef3c7",
    boxBorder: "#f59e0b",
  },
  tweede_aanmaning: {
    titel: "2e Aanmaning",
    preview: "Tweede aanmaning",
    intro:
      "Tot onze spijt moeten wij constateren dat, ondanks onze eerdere aanmaning, de betaling van onderstaande factuur nog steeds niet is ontvangen. Wij verzoeken u met klem het openstaande bedrag binnen 7 dagen te voldoen.",
    afsluiting:
      "Indien wij binnen 7 dagen geen betaling hebben ontvangen, zijn wij genoodzaakt verdere stappen te ondernemen. Dit kan leiden tot buitengerechtelijke incassokosten die voor uw rekening komen.",
    headerColor: "#ea580c", // orange
    boxBg: "#fff7ed",
    boxBorder: "#ea580c",
  },
  ingebrekestelling: {
    titel: "Ingebrekestelling",
    preview: "Ingebrekestelling",
    intro:
      "Ondanks herhaaldelijke aanmaningen hebben wij tot op heden geen betaling ontvangen voor onderstaande factuur. Bij deze stellen wij u formeel in gebreke conform artikel 6:82 van het Burgerlijk Wetboek.",
    afsluiting:
      "Indien het volledige bedrag niet binnen 14 dagen na dagtekening van deze brief op onze rekening is bijgeschreven, zien wij ons genoodzaakt de vordering uit handen te geven aan een incassobureau. Alle hiermee gepaard gaande kosten, waaronder buitengerechtelijke incassokosten conform het Besluit vergoeding voor buitengerechtelijke incassokosten, komen volledig voor uw rekening.",
    headerColor: "#dc2626", // red
    boxBg: "#fef2f2",
    boxBorder: "#dc2626",
  },
};

export function AanmaningEmail({
  klantNaam,
  factuurNummer,
  factuurDatum,
  vervaldatum,
  dagenTeVerlopen,
  totaalInclBtw,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  iban,
  bic,
  kvkNummer,
  btwNummer,
  type,
}: AanmaningEmailProps) {
  const config = typeConfig[type];
  const previewText = `${config.preview}: Factuur ${factuurNummer} - ${dagenTeVerlopen} dagen verlopen`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={{ ...header, backgroundColor: config.headerColor }}>
            <Heading style={logo}>{bedrijfsnaam}</Heading>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>{config.titel}</Heading>

            <Text style={greeting}>Geachte {klantNaam},</Text>

            <Text style={paragraph}>{config.intro}</Text>

            {/* Details Box */}
            <Section
              style={{
                backgroundColor: config.boxBg,
                border: `1px solid ${config.boxBorder}`,
                borderRadius: "8px",
                padding: "20px",
                margin: "24px 0",
              }}
            >
              <Row>
                <Column>
                  <Text style={detailLabel}>Factuurnummer</Text>
                  <Text style={detailValue}>{factuurNummer}</Text>
                </Column>
                <Column>
                  <Text style={detailLabel}>Factuurdatum</Text>
                  <Text style={detailValue}>{factuurDatum}</Text>
                </Column>
              </Row>

              <Hr style={divider} />

              <Row>
                <Column>
                  <Text style={detailLabel}>Oorspronkelijke vervaldatum</Text>
                  <Text style={detailValue}>{vervaldatum}</Text>
                </Column>
                <Column>
                  <Text style={detailLabel}>Aantal dagen verlopen</Text>
                  <Text style={overdueValue}>{dagenTeVerlopen} dagen</Text>
                </Column>
              </Row>

              <Hr style={divider} />

              <Row>
                <Column>
                  <Text style={totalLabel}>Openstaand bedrag</Text>
                </Column>
                <Column align="right">
                  <Text style={totalValueDanger}>
                    {formatCurrency(totaalInclBtw)}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Payment Instructions */}
            <Section style={paymentBox}>
              <Text style={paymentTitle}>Betaalgegevens</Text>
              <Section style={ibanBox}>
                <Row>
                  <Column style={ibanColumn}>
                    <Text style={ibanLabel}>IBAN</Text>
                    <Text style={ibanValue}>{iban}</Text>
                  </Column>
                  {bic && (
                    <Column style={ibanColumn}>
                      <Text style={ibanLabel}>BIC</Text>
                      <Text style={ibanValue}>{bic}</Text>
                    </Column>
                  )}
                </Row>
                <Text style={referenceText}>
                  Vermeld bij de betaling: <strong>{factuurNummer}</strong>
                </Text>
              </Section>
            </Section>

            <Text style={paragraph}>{config.afsluiting}</Text>

            <Text style={signoff}>
              Hoogachtend,
              <br />
              <strong>{bedrijfsnaam}</strong>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              {bedrijfsnaam}
              {bedrijfsEmail && (
                <>
                  {" | "}
                  <Link href={`mailto:${bedrijfsEmail}`} style={footerLink}>
                    {bedrijfsEmail}
                  </Link>
                </>
              )}
              {bedrijfsTelefoon && ` | ${bedrijfsTelefoon}`}
            </Text>
            {(kvkNummer || btwNummer) && (
              <Text style={footerLegal}>
                {kvkNummer && `KVK: ${kvkNummer}`}
                {kvkNummer && btwNummer && " | "}
                {btwNummer && `BTW: ${btwNummer}`}
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  maxWidth: "600px",
};

const header = {
  padding: "24px 32px",
};

const logo = {
  color: "#ffffff",
  fontSize: "24px",
  fontWeight: "700" as const,
  margin: "0",
};

const content = {
  padding: "32px",
};

const h1 = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "600" as const,
  margin: "0 0 24px",
};

const greeting = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const paragraph = {
  color: "#4b5563",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const detailLabel = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "500" as const,
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
};

const detailValue = {
  color: "#1f2937",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0",
};

const overdueValue = {
  color: "#dc2626",
  fontSize: "16px",
  fontWeight: "700" as const,
  margin: "0",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "16px 0",
};

const totalLabel = {
  color: "#1f2937",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0",
};

const totalValueDanger = {
  color: "#dc2626",
  fontSize: "24px",
  fontWeight: "700" as const,
  margin: "0",
};

const paymentBox = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
};

const paymentTitle = {
  color: "#374151",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 12px",
};

const ibanBox = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  padding: "16px",
};

const ibanColumn = {
  paddingRight: "16px",
};

const ibanLabel = {
  color: "#6b7280",
  fontSize: "11px",
  fontWeight: "500" as const,
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
};

const ibanValue = {
  color: "#1f2937",
  fontSize: "16px",
  fontWeight: "700" as const,
  fontFamily: "monospace",
  margin: "0",
};

const referenceText = {
  color: "#374151",
  fontSize: "13px",
  margin: "12px 0 0",
};

const signoff = {
  color: "#4b5563",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "24px 0 0",
};

const footerSection = {
  backgroundColor: "#f9fafb",
  borderTop: "1px solid #e5e7eb",
  padding: "24px 32px",
};

const footerText = {
  color: "#6b7280",
  fontSize: "13px",
  margin: "0",
  textAlign: "center" as const,
};

const footerLegal = {
  color: "#9ca3af",
  fontSize: "11px",
  margin: "8px 0 0",
  textAlign: "center" as const,
};

const footerLink = {
  color: "#16a34a",
  textDecoration: "none",
};

export default AanmaningEmail;
