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

const messageBox = {
  backgroundColor: kleur.kaart,
  border: `1px solid ${kleur.lijn}`,
  borderLeft: `4px solid ${kleur.goud}`,
  borderRadius: "0 8px 8px 0",
  padding: "16px 20px",
  margin: "16px 0 24px",
};

const messageLabel = {
  color: kleur.tekstZacht,
  fontSize: "12px",
  fontWeight: "500" as const,
  textTransform: "uppercase" as const,
  margin: "0 0 8px",
};

const messageText = {
  color: kleur.tekst,
  fontSize: "15px",
  lineHeight: "24px",
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

export default PortaalBerichtEmail;
