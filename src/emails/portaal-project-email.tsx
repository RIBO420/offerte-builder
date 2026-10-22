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
import { kleur, knop, kopBalk, letter, woordmerk } from "@/emails/huisstijl";

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
  backgroundColor: kleur.achtergrond,
  fontFamily: letter,
};

const container = {
  backgroundColor: kleur.warmWit,
  margin: "0 auto",
  maxWidth: "600px",
};

const header = kopBalk;

const logo = woordmerk;

const content = {
  padding: "32px",
};

const h1 = {
  color: kleur.tekst,
  fontSize: "24px",
  fontWeight: "600" as const,
  margin: "0 0 24px",
};

const greeting = {
  color: kleur.tekst,
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const paragraph = {
  color: kleur.tekstZacht,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const statusBox = {
  backgroundColor: kleur.mosVlak,
  border: `1px solid ${kleur.mosLijn}`,
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
};

const statusBoxLabel = {
  color: kleur.tekstZacht,
  fontSize: "12px",
  fontWeight: "500" as const,
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
};

const statusBoxValue = {
  color: kleur.tekst,
  fontSize: "18px",
  fontWeight: "600" as const,
  margin: "0",
};

const innerDivider = {
  borderColor: kleur.mosLijn,
  margin: "12px 0",
};

const statusBadgeContainer = {
  margin: "0",
};

const statusBadge = {
  backgroundColor: kleur.mos,
  borderRadius: "12px",
  color: kleur.warmWit,
  display: "inline-block",
  fontSize: "13px",
  fontWeight: "600" as const,
  margin: "0",
  padding: "4px 12px",
};

const toelichtingText = {
  color: kleur.tekst,
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0",
  fontStyle: "italic" as const,
};

const ctaSection = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const ctaButton = knop;

const divider = {
  borderColor: kleur.lijn,
  margin: "24px 0",
};

const signoff = {
  color: kleur.tekstZacht,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0",
};

const footer = {
  backgroundColor: kleur.achtergrond,
  borderTop: `1px solid ${kleur.lijn}`,
  padding: "24px 32px",
};

const footerText = {
  color: kleur.tekstZacht,
  fontSize: "13px",
  margin: "0",
  textAlign: "center" as const,
};

const footerLink = {
  color: kleur.mos,
  textDecoration: "none",
};

export default PortaalProjectEmail;
