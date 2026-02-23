import {
  Body,
  Button,
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

interface DatumOptie {
  datum: string; // ISO date string
  tijdslot: string; // bijv. "09:00 - 10:00"
  url: string; // booking link
}

export interface BevestigingEmailProps {
  klantNaam: string;
  aanvraagType: "offerte" | "configurator" | "contact";
  aanvraagDetails?: string;
  datumOpties: DatumOptie[];
  calendlyUrl?: string;
  bedrijfsnaam: string;
  bedrijfsEmail: string;
  bedrijfsTelefoon: string;
  bedrijfsAdres?: string;
}

const aanvraagTypeLabels: Record<BevestigingEmailProps["aanvraagType"], string> = {
  offerte: "offerte-aanvraag",
  configurator: "tuinconfiguratie",
  contact: "contactaanvraag",
};

function formatDatum(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BevestigingEmail({
  klantNaam,
  aanvraagType,
  aanvraagDetails,
  datumOpties,
  calendlyUrl,
  bedrijfsnaam,
  bedrijfsEmail,
  bedrijfsTelefoon,
  bedrijfsAdres,
}: BevestigingEmailProps) {
  const aanvraagLabel = aanvraagTypeLabels[aanvraagType];

  return (
    <Html>
      <Head />
      <Preview>
        Uw {aanvraagLabel} is ontvangen — wij nemen spoedig contact op
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logo}>{bedrijfsnaam}</Heading>
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>Uw aanvraag is ontvangen</Heading>

            <Text style={greeting}>Beste {klantNaam},</Text>

            <Text style={paragraph}>
              Hartelijk dank voor uw {aanvraagLabel}. Wij hebben uw bericht in
              goede orde ontvangen en nemen zo spoedig mogelijk contact met u
              op.
            </Text>

            {aanvraagDetails && (
              <Section style={detailsBox}>
                <Text style={detailLabel}>Uw aanvraag</Text>
                <Text style={detailValue}>{aanvraagDetails}</Text>
              </Section>
            )}

            {/* Werkproces */}
            <Section style={procesSection}>
              <Text style={procesHeading}>Hoe gaat het verder?</Text>

              <Section style={procesStap}>
                <Text style={stapNummer}>1</Text>
                <Text style={stapTekst}>
                  <strong>Beoordeling van uw aanvraag</strong>
                  <br />
                  Wij beoordelen uw aanvraag binnen 2 werkdagen en nemen
                  contact met u op om uw wensen te bespreken.
                </Text>
              </Section>

              <Section style={procesStap}>
                <Text style={stapNummer}>2</Text>
                <Text style={stapTekst}>
                  <strong>Offerte op maat</strong>
                  <br />
                  U ontvangt een gedetailleerde offerte op maat, afgestemd op
                  uw specifieke situatie en wensen.
                </Text>
              </Section>

              <Section style={procesStap}>
                <Text style={stapNummer}>3</Text>
                <Text style={stapTekst}>
                  <strong>Inplannen werkzaamheden</strong>
                  <br />
                  Na uw akkoord plannen wij de werkzaamheden in op een datum
                  die u het beste uitkomt.
                </Text>
              </Section>
            </Section>

            {/* Datumkeuze sectie */}
            {datumOpties.length > 0 && (
              <>
                <Hr style={divider} />

                <Section style={datumSection}>
                  <Heading style={h2}>Plan een vrijblijvend gesprek</Heading>
                  <Text style={paragraph}>
                    Kies een datum die u het beste uitkomt voor een
                    vrijblijvend kennismakingsgesprek. Zo kunnen wij uw wensen
                    persoonlijk bespreken.
                  </Text>

                  {datumOpties.map((optie, index) => (
                    <Section key={index} style={datumOptieContainer}>
                      <Section style={datumOptieInner}>
                        <Text style={datumTekst}>
                          <strong>{formatDatum(optie.datum)}</strong>
                          <br />
                          <span style={tijdslotTekst}>{optie.tijdslot}</span>
                        </Text>
                        <Button style={datumButton} href={optie.url}>
                          Kies dit tijdstip
                        </Button>
                      </Section>
                    </Section>
                  ))}

                  {calendlyUrl && (
                    <Text style={calendlyTekst}>
                      Geen van deze tijdstippen schikt?{" "}
                      <Link href={calendlyUrl} style={link}>
                        Bekijk alle beschikbare momenten
                      </Link>
                    </Text>
                  )}
                </Section>
              </>
            )}

            <Hr style={divider} />

            <Text style={signoff}>
              Met vriendelijke groet,
              <br />
              <strong>{bedrijfsnaam}</strong>
            </Text>

            <Text style={disclaimer}>
              Dit is een automatisch bericht — antwoord niet op deze email.
              Voor vragen kunt u contact opnemen via{" "}
              <Link href={`mailto:${bedrijfsEmail}`} style={link}>
                {bedrijfsEmail}
              </Link>{" "}
              of bel ons op {bedrijfsTelefoon}.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              {bedrijfsnaam}
              {" | "}
              <Link href={`mailto:${bedrijfsEmail}`} style={footerLink}>
                {bedrijfsEmail}
              </Link>
              {" | "}
              {bedrijfsTelefoon}
              {bedrijfsAdres && ` | ${bedrijfsAdres}`}
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

const h2 = {
  color: "#1f2937",
  fontSize: "18px",
  fontWeight: "600" as const,
  margin: "0 0 12px",
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
  margin: "0 0 24px",
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
  fontSize: "15px",
  lineHeight: "22px",
  margin: "0",
};

const procesSection = {
  margin: "24px 0",
};

const procesHeading = {
  color: "#1f2937",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 16px",
};

const procesStap = {
  display: "flex" as const,
  marginBottom: "12px",
  paddingLeft: "0",
};

const stapNummer = {
  backgroundColor: "#16a34a",
  borderRadius: "50%",
  color: "#ffffff",
  display: "inline-block" as const,
  fontSize: "13px",
  fontWeight: "700" as const,
  height: "24px",
  lineHeight: "24px",
  margin: "0 12px 0 0",
  minWidth: "24px",
  textAlign: "center" as const,
  width: "24px",
};

const stapTekst = {
  color: "#4b5563",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const datumSection = {
  margin: "0 0 8px",
};

const datumOptieContainer = {
  margin: "0 0 12px",
};

const datumOptieInner = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "16px 20px",
};

const datumTekst = {
  color: "#1f2937",
  fontSize: "15px",
  lineHeight: "22px",
  margin: "0 0 12px",
};

const tijdslotTekst = {
  color: "#16a34a",
  fontSize: "14px",
  fontWeight: "500" as const,
};

const datumButton = {
  backgroundColor: "#16a34a",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block" as const,
  fontSize: "14px",
  fontWeight: "600" as const,
  padding: "10px 20px",
  textDecoration: "none",
};

const calendlyTekst = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "16px 0 0",
};

const link = {
  color: "#16a34a",
  textDecoration: "underline",
};

const signoff = {
  color: "#4b5563",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const disclaimer = {
  backgroundColor: "#fef9c3",
  border: "1px solid #fde047",
  borderRadius: "6px",
  color: "#713f12",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
  padding: "12px 16px",
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

export default BevestigingEmail;
