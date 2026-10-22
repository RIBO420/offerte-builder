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
import { kleur, kopBalk, letter, woordmerk } from "@/emails/huisstijl";

interface FactuurEmailProps {
  klantNaam: string;
  factuurNummer: string;
  factuurDatum: string;
  vervaldatum: string;
  totaalInclBtw: number;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  iban: string;
  bic?: string;
  kvkNummer?: string;
  btwNummer?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function FactuurEmail({
  klantNaam,
  factuurNummer,
  factuurDatum,
  vervaldatum,
  totaalInclBtw,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  iban,
  bic,
  kvkNummer,
  btwNummer,
}: FactuurEmailProps) {
  const previewText = `Factuur ${factuurNummer} van ${bedrijfsnaam}`;

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
            <Heading style={h1}>Factuur</Heading>

            <Text style={greeting}>Beste {klantNaam},</Text>

            <Text style={paragraph}>
              Hierbij ontvangt u de factuur voor de uitgevoerde werkzaamheden.
              Wij danken u voor uw vertrouwen in {bedrijfsnaam}.
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

              <Hr style={divider} />

              <Row>
                <Column>
                  <Text style={detailLabel}>Vervaldatum</Text>
                  <Text style={detailValue}>{vervaldatum}</Text>
                </Column>
                <Column align="right">
                  <Text style={totalLabel}>Totaal incl. BTW</Text>
                  <Text style={totalValue}>{formatCurrency(totaalInclBtw)}</Text>
                </Column>
              </Row>
            </Section>

            {/* Payment Instructions */}
            <Section style={paymentBox}>
              <Text style={paymentTitle}>Betaalgegevens</Text>
              <Text style={paymentText}>
                Wij verzoeken u vriendelijk het bovenstaande bedrag binnen de
                gestelde betalingstermijn over te maken naar onderstaande
                rekening:
              </Text>

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

            <Text style={paragraph}>
              De factuur is als PDF bijgevoegd bij deze email. Heeft u vragen
              over deze factuur? Neem dan gerust contact met ons op.
            </Text>

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

interface FactuurHerinneringEmailProps {
  klantNaam: string;
  factuurNummer: string;
  factuurDatum: string;
  oorspronkelijkeVervaldatum: string;
  dagenTeVerlopen: number;
  totaalInclBtw: number;
  bedrijfsnaam: string;
  bedrijfsEmail?: string;
  bedrijfsTelefoon?: string;
  iban: string;
  bic?: string;
}

export function FactuurHerinneringEmail({
  klantNaam,
  factuurNummer,
  factuurDatum,
  oorspronkelijkeVervaldatum,
  dagenTeVerlopen,
  totaalInclBtw,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  iban,
  bic,
}: FactuurHerinneringEmailProps) {
  const previewText = `Betalingsherinnering: Factuur ${factuurNummer} - ${dagenTeVerlopen} dagen verlopen`;

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
            <Heading style={h1}>Betalingsherinnering</Heading>

            <Text style={greeting}>Beste {klantNaam},</Text>

            <Text style={paragraph}>
              Graag willen wij u vriendelijk herinneren aan de openstaande
              factuur. Volgens onze administratie is de betalingstermijn
              inmiddels verstreken.
            </Text>

            {/* Factuur Details Box */}
            <Section style={detailsBoxWarning}>
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
                  <Text style={detailValue}>{oorspronkelijkeVervaldatum}</Text>
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
                  <Text style={totalValueWarning}>
                    {formatCurrency(totaalInclBtw)}
                  </Text>
                </Column>
              </Row>
            </Section>

            <Text style={paragraph}>
              Wij verzoeken u vriendelijk om het openstaande bedrag zo spoedig
              mogelijk over te maken naar onderstaande rekening. Mocht u de
              betaling reeds hebben voldaan, dan kunt u deze herinnering als
              niet verzonden beschouwen.
            </Text>

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

            <Text style={paragraph}>
              Heeft u vragen over deze factuur of wilt u een betalingsregeling
              bespreken? Neem dan gerust contact met ons op. Wij denken graag
              met u mee.
            </Text>

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

const detailsBoxWarning = {
  backgroundColor: kleur.wachtVlak,
  border: `1px solid ${kleur.wachtLijn}`,
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

const overdueValue = {
  color: kleur.negatief,
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0",
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

const totalValueWarning = {
  color: kleur.negatief,
  fontSize: "24px",
  fontWeight: "600" as const,
  margin: "0",
};

const paymentBox = {
  backgroundColor: kleur.mosVlak,
  border: `1px solid ${kleur.mosLijn}`,
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
};

const paymentTitle = {
  color: kleur.mos,
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 12px",
};

const paymentText = {
  color: kleur.tekstZacht,
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 16px",
};

const ibanBox = {
  backgroundColor: kleur.kaart,
  border: `1px solid ${kleur.mosLijn}`,
  borderRadius: "6px",
  padding: "16px",
};

const ibanColumn = {
  paddingRight: "16px",
};

const ibanLabel = {
  color: kleur.tekstZacht,
  fontSize: "11px",
  fontWeight: "500" as const,
  textTransform: "uppercase" as const,
  margin: "0 0 4px",
};

const ibanValue = {
  color: kleur.tekst,
  fontSize: "16px",
  fontWeight: "600" as const,
  fontFamily: "monospace",
  margin: "0",
};

const referenceText = {
  color: kleur.tekst,
  fontSize: "13px",
  margin: "12px 0 0",
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

const footerLegal = {
  color: kleur.tekstZwak,
  fontSize: "11px",
  margin: "8px 0 0",
  textAlign: "center" as const,
};

const footerLink = {
  color: kleur.mos,
  textDecoration: "none",
};

export default FactuurEmail;
