import "server-only";

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
import { kleur, knop, kopBalk, letter, woordmerk } from "@/emails/huisstijl";

interface PortaalFactuurEmailProps {
  klantNaam: string;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  factuurNummer: string;
  factuurDatum: string;
  vervaldatum: string;
  totaalInclBtw: number;
  portaalUrl: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function PortaalFactuurEmail({
  klantNaam,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  factuurNummer,
  factuurDatum,
  vervaldatum,
  totaalInclBtw,
  portaalUrl,
}: PortaalFactuurEmailProps) {
  const previewText = `Nieuwe factuur ${factuurNummer} van ${bedrijfsnaam}`;

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
            <Heading style={h1}>Nieuwe factuur</Heading>

            <Text style={greeting}>Beste {klantNaam},</Text>

            <Text style={paragraph}>
              Er is een nieuwe factuur voor u aangemaakt. U kunt deze inzien en
              downloaden via uw persoonlijke portaal.
            </Text>

            {/* Factuur Details Box */}
            <Section style={detailsBox}>
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

              <Hr style={innerDivider} />

              <Row>
                <Column>
                  <Text style={detailLabel}>Vervaldatum</Text>
                  <Text style={detailValue}>{vervaldatum}</Text>
                </Column>
                <Column align="right">
                  <Text style={detailLabel}>Totaal incl. BTW</Text>
                  <Text style={amountValue}>
                    {formatCurrency(totaalInclBtw)}
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* CTA Button */}
            <Section style={ctaSection}>
              <Link href={portaalUrl} style={ctaButton}>
                Factuur bekijken
              </Link>
            </Section>

            <Text style={paragraph}>
              Heeft u vragen over deze factuur? U kunt via het portaal direct een
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

const detailsBox = {
  backgroundColor: kleur.kaart,
  border: `1px solid ${kleur.lijn}`,
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
};

const detailLabel = {
  color: kleur.tekstZacht,
  fontSize: "12px",
  fontWeight: "500" as const,
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
};

const detailValue = {
  color: kleur.tekst,
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0",
};

const innerDivider = {
  borderColor: kleur.lijn,
  margin: "12px 0",
};

const amountValue = {
  color: kleur.mos,
  fontSize: "20px",
  fontWeight: "600" as const,
  margin: "0",
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

export default PortaalFactuurEmail;
