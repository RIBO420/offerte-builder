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

interface PortaalUitnodigingEmailProps {
  klantNaam: string;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  registratieUrl: string;
}

export function PortaalUitnodigingEmail({
  klantNaam,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  registratieUrl,
}: PortaalUitnodigingEmailProps) {
  const previewText = `Welkom bij het klantenportaal van ${bedrijfsnaam}`;

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
            <Heading style={h1}>Welkom bij uw klantenportaal</Heading>

            <Text style={greeting}>Beste {klantNaam},</Text>

            <Text style={paragraph}>
              U bent uitgenodigd om gebruik te maken van het klantenportaal van{" "}
              {bedrijfsnaam}. Via dit portaal kunt u eenvoudig:
            </Text>

            <Section style={featureBox}>
              <Text style={featureItem}>
                Uw offertes bekijken en goedkeuren
              </Text>
              <Text style={featureItem}>Facturen inzien en downloaden</Text>
              <Text style={featureItem}>
                De voortgang van uw project volgen
              </Text>
              <Text style={featureItem}>
                Direct berichten sturen naar ons team
              </Text>
            </Section>

            <Text style={paragraph}>
              Klik op de onderstaande knop om uw account aan te maken en direct
              toegang te krijgen tot uw persoonlijke portaal.
            </Text>

            {/* CTA Button */}
            <Section style={ctaSection}>
              <Link href={registratieUrl} style={ctaButton}>
                Account aanmaken
              </Link>
            </Section>

            <Text style={smallText}>
              Deze uitnodiging is 7 dagen geldig. Heeft u de link niet
              aangevraagd? Dan kunt u deze e-mail negeren.
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

const featureBox = {
  backgroundColor: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "16px 0 24px",
};

const featureItem = {
  color: "#166534",
  fontSize: "14px",
  lineHeight: "28px",
  margin: "0",
  paddingLeft: "8px",
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

const smallText = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "16px 0 0",
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

export default PortaalUitnodigingEmail;
