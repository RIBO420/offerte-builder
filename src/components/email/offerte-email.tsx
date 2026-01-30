import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from "@react-email/components";

interface OfferteEmailProps {
  type: "offerte_verzonden" | "herinnering" | "bedankt";
  klantNaam: string;
  offerteNummer: string;
  totaalInclBtw: number;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  offerteType: "aanleg" | "onderhoud";
  scopes?: string[];
}

const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  houtwerk: "Houtwerk",
  schuttingen: "Schuttingen",
  waterpartijen: "Waterpartijen",
  verlichting: "Verlichting",
  gras: "Gras",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function OfferteEmail({
  type,
  klantNaam,
  offerteNummer,
  totaalInclBtw,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  offerteType,
  scopes,
}: OfferteEmailProps) {
  const previewText = {
    offerte_verzonden: `Offerte ${offerteNummer} van ${bedrijfsnaam}`,
    herinnering: `Herinnering: Offerte ${offerteNummer} wacht op uw reactie`,
    bedankt: `Bedankt voor uw opdracht - Offerte ${offerteNummer}`,
  };

  const heading = {
    offerte_verzonden: "Uw Offerte",
    herinnering: "Herinnering: Uw Offerte",
    bedankt: "Bedankt voor uw opdracht!",
  };

  const intro = {
    offerte_verzonden: `Hierbij ontvangt u de offerte voor de ${offerteType === "aanleg" ? "aanleg" : "onderhoud"}werkzaamheden aan uw tuin.`,
    herinnering: `We willen u graag herinneren aan de offerte die we eerder hebben gestuurd. We horen graag of u nog vragen heeft.`,
    bedankt: `Hartelijk dank voor het accepteren van onze offerte. We kijken ernaar uit om aan de slag te gaan met uw ${offerteType === "aanleg" ? "tuinaanleg" : "tuinonderhoud"}.`,
  };

  return (
    <Html>
      <Head />
      <Preview>{previewText[type]}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logo}>{bedrijfsnaam}</Heading>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>{heading[type]}</Heading>

            <Text style={greeting}>Beste {klantNaam},</Text>

            <Text style={paragraph}>{intro[type]}</Text>

            {/* Offerte Details Box */}
            <Section style={detailsBox}>
              <Row>
                <Column>
                  <Text style={detailLabel}>Offertenummer</Text>
                  <Text style={detailValue}>{offerteNummer}</Text>
                </Column>
                <Column>
                  <Text style={detailLabel}>Type</Text>
                  <Text style={detailValue}>
                    {offerteType === "aanleg" ? "Tuinaanleg" : "Tuinonderhoud"}
                  </Text>
                </Column>
              </Row>

              {scopes && scopes.length > 0 && (
                <>
                  <Hr style={divider} />
                  <Text style={detailLabel}>Werkzaamheden</Text>
                  <Text style={scopeList}>
                    {scopes.map((s) => scopeLabels[s] || s).join(" • ")}
                  </Text>
                </>
              )}

              <Hr style={divider} />

              <Row>
                <Column>
                  <Text style={totalLabel}>Totaal incl. BTW</Text>
                </Column>
                <Column align="right">
                  <Text style={totalValue}>{formatCurrency(totaalInclBtw)}</Text>
                </Column>
              </Row>
            </Section>

            {type === "offerte_verzonden" && (
              <Text style={paragraph}>
                De offerte is als PDF bijgevoegd bij deze email. Heeft u vragen of
                wilt u de offerte bespreken? Neem dan gerust contact met ons op.
              </Text>
            )}

            {type === "herinnering" && (
              <Text style={paragraph}>
                We begrijpen dat u het druk heeft. Mocht u nog vragen hebben over
                de offerte, dan helpen we u graag verder. De offerte blijft
                geldig tot 30 dagen na verzending.
              </Text>
            )}

            {type === "bedankt" && (
              <Text style={paragraph}>
                We nemen binnenkort contact met u op om een afspraak te maken
                voor de uitvoering van de werkzaamheden.
              </Text>
            )}

            <Text style={signoff}>
              Met vriendelijke groet,
              <br />
              <strong>{bedrijfsnaam}</strong>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
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
  backgroundColor: "#16a34a",
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

const detailsBox = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
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

const scopeList = {
  color: "#374151",
  fontSize: "14px",
  margin: "4px 0 0",
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

const totalValue = {
  color: "#16a34a",
  fontSize: "24px",
  fontWeight: "700" as const,
  margin: "0",
};

const signoff = {
  color: "#4b5563",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "24px 0 0",
};

const footer = {
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

const footerLink = {
  color: "#16a34a",
  textDecoration: "none",
};

export default OfferteEmail;
