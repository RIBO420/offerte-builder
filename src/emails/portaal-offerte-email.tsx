import "server-only";

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
} from "@react-email/components";

interface PortaalOfferteEmailProps {
  klantNaam: string;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  offerteNummer: string;
  offerteBedrag?: string;
  portaalUrl: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export { formatCurrency };

export function PortaalOfferteEmail({
  klantNaam,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  offerteNummer,
  offerteBedrag,
  portaalUrl,
}: PortaalOfferteEmailProps) {
  const previewText = `Nieuwe offerte ${offerteNummer} beschikbaar van ${bedrijfsnaam}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logo}>{bedrijfsnaam}</Heading>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>Nieuwe offerte beschikbaar</Heading>

            <Text style={greeting}>Beste {klantNaam},</Text>

            <Text style={paragraph}>
              Er staat een nieuwe offerte voor u klaar. Via uw persoonlijke
              portaal kunt u de offerte inzien, downloaden en direct goedkeuren.
            </Text>

            {/* Offerte Details Box */}
            <Section style={detailsBox}>
              <Text style={detailLabel}>Offertenummer</Text>
              <Text style={detailValue}>{offerteNummer}</Text>
              {offerteBedrag && (
                <>
                  <Hr style={innerDivider} />
                  <Text style={detailLabel}>Bedrag incl. BTW</Text>
                  <Text style={amountValue}>{offerteBedrag}</Text>
                </>
              )}
            </Section>

            {/* CTA Button */}
            <Section style={ctaSection}>
              <Link href={portaalUrl} style={ctaButton}>
                Offerte bekijken
              </Link>
            </Section>

            <Text style={paragraph}>
              Heeft u vragen over deze offerte? U kunt via het portaal direct een
              bericht sturen of contact opnemen met ons kantoor.
            </Text>

            <Hr style={divider} />

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

const innerDivider = {
  borderColor: "#e5e7eb",
  margin: "12px 0",
};

const amountValue = {
  color: "#16a34a",
  fontSize: "20px",
  fontWeight: "700" as const,
  margin: "0",
};

const ctaSection = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const ctaButton = {
  backgroundColor: "#16a34a",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600" as const,
  padding: "14px 32px",
  textDecoration: "none",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const signoff = {
  color: "#4b5563",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0",
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

export default PortaalOfferteEmail;
