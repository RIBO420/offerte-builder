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

interface PortaalProjectEmailProps {
  klantNaam: string;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  projectNaam: string;
  nieuweStatus: string;
  statusToelichting?: string;
  portaalUrl: string;
}

/** Map internal status codes to Dutch human-readable labels */
const STATUS_LABELS: Record<string, string> = {
  gepland: "Gepland",
  in_voorbereiding: "In voorbereiding",
  actief: "In uitvoering",
  in_uitvoering: "In uitvoering",
  paused: "Gepauzeerd",
  opgeleverd: "Opgeleverd",
  afgerond: "Afgerond",
  geannuleerd: "Geannuleerd",
};

export function PortaalProjectEmail({
  klantNaam,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  projectNaam,
  nieuweStatus,
  statusToelichting,
  portaalUrl,
}: PortaalProjectEmailProps) {
  const statusLabel = STATUS_LABELS[nieuweStatus] || nieuweStatus;
  const previewText = `Update: project "${projectNaam}" — ${statusLabel}`;

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
            <Heading style={h1}>Update over uw project</Heading>

            <Text style={greeting}>Beste {klantNaam},</Text>

            <Text style={paragraph}>
              Wij willen u graag informeren over een update van uw project bij{" "}
              {bedrijfsnaam}.
            </Text>

            {/* Project Status Box */}
            <Section style={statusBox}>
              <Text style={statusBoxLabel}>Project</Text>
              <Text style={statusBoxValue}>{projectNaam}</Text>

              <Hr style={innerDivider} />

              <Text style={statusBoxLabel}>Nieuwe status</Text>
              <Section style={statusBadgeContainer}>
                <Text style={statusBadge}>{statusLabel}</Text>
              </Section>

              {statusToelichting && (
                <>
                  <Hr style={innerDivider} />
                  <Text style={statusBoxLabel}>Toelichting</Text>
                  <Text style={toelichtingText}>{statusToelichting}</Text>
                </>
              )}
            </Section>

            <Text style={paragraph}>
              Bekijk de volledige details en voortgang van uw project via uw
              persoonlijke portaal.
            </Text>

            {/* CTA Button */}
            <Section style={ctaSection}>
              <Link href={portaalUrl} style={ctaButton}>
                Project bekijken
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

const statusBox = {
  backgroundColor: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
};

const statusBoxLabel = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "500" as const,
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
};

const statusBoxValue = {
  color: "#1f2937",
  fontSize: "18px",
  fontWeight: "600" as const,
  margin: "0",
};

const innerDivider = {
  borderColor: "#bbf7d0",
  margin: "12px 0",
};

const statusBadgeContainer = {
  margin: "0",
};

const statusBadge = {
  backgroundColor: "#16a34a",
  borderRadius: "12px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "13px",
  fontWeight: "600" as const,
  margin: "0",
  padding: "4px 12px",
};

const toelichtingText = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
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

export default PortaalProjectEmail;
