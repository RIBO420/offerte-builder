import "server-only";

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
import { kleur, kopBalk, letter, woordmerk } from "@/emails/huisstijl";

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

const h2 = {
  color: kleur.tekst,
  fontSize: "18px",
  fontWeight: "600" as const,
  margin: "0 0 12px",
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
  margin: "0 0 24px",
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
  fontSize: "15px",
  lineHeight: "22px",
  margin: "0",
};

const procesSection = {
  margin: "24px 0",
};

const procesHeading = {
  color: kleur.tekst,
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
  backgroundColor: kleur.mos,
  borderRadius: "50%",
  color: kleur.warmWit,
  display: "inline-block" as const,
  fontSize: "13px",
  fontWeight: "600" as const,
  height: "24px",
  lineHeight: "24px",
  margin: "0 12px 0 0",
  minWidth: "24px",
  textAlign: "center" as const,
  width: "24px",
};

const stapTekst = {
  color: kleur.tekstZacht,
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0",
};

const divider = {
  borderColor: kleur.lijn,
  margin: "24px 0",
};

const datumSection = {
  margin: "0 0 8px",
};

const datumOptieContainer = {
  margin: "0 0 12px",
};

const datumOptieInner = {
  backgroundColor: kleur.kaart,
  border: `1px solid ${kleur.lijn}`,
  borderRadius: "8px",
  padding: "16px 20px",
};

const datumTekst = {
  color: kleur.tekst,
  fontSize: "15px",
  lineHeight: "22px",
  margin: "0 0 12px",
};

const tijdslotTekst = {
  color: kleur.mos,
  fontSize: "14px",
  fontWeight: "500" as const,
};

const datumButton = {
  backgroundColor: kleur.mos,
  borderRadius: "6px",
  color: kleur.warmWit,
  display: "inline-block" as const,
  fontSize: "14px",
  fontWeight: "600" as const,
  padding: "10px 20px",
  textDecoration: "none",
};

const calendlyTekst = {
  color: kleur.tekstZacht,
  fontSize: "13px",
  lineHeight: "20px",
  margin: "16px 0 0",
};

const link = {
  color: kleur.mos,
  textDecoration: "underline",
};

const signoff = {
  color: kleur.tekstZacht,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const disclaimer = {
  backgroundColor: kleur.wachtVlak,
  border: `1px solid ${kleur.wachtLijn}`,
  borderRadius: "6px",
  color: kleur.wachtTekst,
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
  padding: "12px 16px",
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

export default BevestigingEmail;
