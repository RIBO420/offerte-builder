/**
 * Calendly configuratie en helper functies
 *
 * Gebruik NEXT_PUBLIC_CALENDLY_URL om de basis-URL te configureren.
 * Standaard: https://calendly.com/toptuinen
 */

export const CALENDLY_CONFIG = {
  profileUrl:
    process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/toptuinen",
  eventTypes: {
    vrijblijvendGesprek: "vrijblijvend-gesprek", // 30 min
    tuinAdvies: "tuin-advies", // 60 min
    opmeting: "opmeting-ter-plaatse", // 45 min
  },
} as const;

/** Nederlandse labels per event type */
export const CALENDLY_EVENT_LABELS: Record<
  keyof typeof CALENDLY_CONFIG.eventTypes,
  string
> = {
  vrijblijvendGesprek: "Vrijblijvend gesprek (30 min)",
  tuinAdvies: "Tuinadvies op locatie (60 min)",
  opmeting: "Opmeting ter plaatse (45 min)",
};

export interface GetCalendlyUrlOptions {
  eventType: keyof typeof CALENDLY_CONFIG.eventTypes;
  naam?: string;
  email?: string;
  telefoon?: string;
  notities?: string;
}

/**
 * Bouwt een Calendly URL met optioneel vooringevulde klantgegevens.
 *
 * Calendly ondersteunt de volgende query-parameters:
 *   name        – volledige naam van de uitgenodigde
 *   email       – e-mailadres van de uitgenodigde
 *   a1          – antwoord op de eerste aangepaste vraag (bijv. telefoonnummer)
 *   notes       – vrije notities die worden meegegeven aan de afspraak
 */
export function getCalendlyUrl(options: GetCalendlyUrlOptions): string {
  const { eventType, naam, email, telefoon, notities } = options;
  const slug = CALENDLY_CONFIG.eventTypes[eventType];
  const baseUrl = `${CALENDLY_CONFIG.profileUrl}/${slug}`;

  const params = new URLSearchParams();

  if (naam) params.set("name", naam);
  if (email) params.set("email", email);
  if (telefoon) params.set("a1", telefoon);
  if (notities) params.set("notes", notities);

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/** Type voor binnenkomende Calendly webhook-events */
export interface CalendlyWebhookEvent {
  event: "invitee.created" | "invitee.canceled";
  payload: {
    event_type: {
      name: string;
      slug: string;
    };
    invitee: {
      name: string;
      email: string;
    };
    scheduled_event: {
      start_time: string;
      end_time: string;
      location: {
        type: string;
      };
    };
  };
}
