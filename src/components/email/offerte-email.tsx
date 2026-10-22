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
  Row,
  Column,
} from "@react-email/components";
import { kleur, kopBalk, letter, woordmerk } from "@/emails/huisstijl";

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
  customMessage?: string;
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
  customMessage,
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

            {customMessage && (
              <Section style={customMessageBox}>
                <Text style={customMessageText}>{customMessage}</Text>
              </Section>
            )}

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

const customMessageBox = {
  backgroundColor: kleur.mosVlak,
  borderLeft: `4px solid ${kleur.goud}`,
  borderRadius: "0 8px 8px 0",
  padding: "16px 20px",
  margin: "0 0 16px",
};

const customMessageText = {
  color: kleur.tekst,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0",
  fontStyle: "italic" as const,
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

const scopeList = {
  color: kleur.tekst,
  fontSize: "14px",
  margin: "4px 0 0",
};

const divider = {
  borderColor: kleur.lijn,
  margin: "16px 0",
};

const totalLabel = {
  color: kleur.tekst,
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0",
};

const totalValue = {
  color: kleur.mos,
  fontSize: "24px",
  fontWeight: "600" as const,
  margin: "0",
};

const signoff = {
  color: kleur.tekstZacht,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "24px 0 0",
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

export default OfferteEmail;
