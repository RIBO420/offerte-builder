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

interface PortaalBerichtEmailProps {
  klantNaam: string;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  berichtVoorbeeld?: string;
  afzenderNaam?: string;
  portaalUrl: string;
}

export function PortaalBerichtEmail({
  klantNaam,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  berichtVoorbeeld,
  afzenderNaam,
  portaalUrl,
}: PortaalBerichtEmailProps) {
  const previewText = `Nieuw bericht van ${afzenderNaam || bedrijfsnaam}`;

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
            <Heading style={h1}>Nieuw bericht</Heading>

            <Text style={greeting}>Beste {klantNaam},</Text>

            <Text style={paragraph}>
              U heeft een nieuw bericht ontvangen
              {afzenderNaam ? ` van ${afzenderNaam}` : ""} via het
              klantenportaal van {bedrijfsnaam}.
            </Text>

            {/* Message Preview Box */}
            {berichtVoorbeeld && (
              <Section style={messageBox}>
                <Text style={messageLabel}>Bericht</Text>
                <Text style={messageText}>{berichtVoorbeeld}</Text>
              </Section>
            )}

            <Text style={paragraph}>
              Log in op uw portaal om het volledige bericht te lezen en te
              reageren.
            </Text>

            {/* CTA Button */}
            <Section style={ctaSection}>
              <Link href={portaalUrl} style={ctaButton}>
                Bericht bekijken
              </Link>
            </Section>

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

const messageBox = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderLeft: "4px solid #16a34a",
  borderRadius: "0 8px 8px 0",
  padding: "16px 20px",
  margin: "16px 0 24px",
};

const messageLabel = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "500" as const,
  textTransform: "uppercase" as const,
  margin: "0 0 8px",
};

const messageText = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0",
  fontStyle: "italic" as const,
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

export default PortaalBerichtEmail;
