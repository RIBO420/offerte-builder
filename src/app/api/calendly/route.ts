/**
 * Calendly Webhook Route
 *
 * Ontvangt POST-verzoeken van Calendly wanneer een afspraak wordt aangemaakt
 * of geannuleerd. De webhook-URL moet worden ingesteld in het Calendly-dashboard
 * onder "Webhooks" → "Create new webhook subscription".
 *
 * Optionele handtekening-verificatie:
 *   Stel CALENDLY_WEBHOOK_SIGNING_KEY in als omgevingsvariabele.
 *   Calendly stuurt de handtekening mee als "Calendly-Webhook-Signature" header
 *   in het formaat: "t=<timestamp>,v1=<hmac-sha256>".
 *
 * TODO: Sla afspraakinformatie op in Convex in plaats van alleen te loggen.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

import type { CalendlyWebhookEvent } from "@/lib/calendly";

const SIGNING_KEY = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

/**
 * Verifieert de Calendly webhook-handtekening.
 *
 * Calendly stuurt de header in dit formaat:
 *   Calendly-Webhook-Signature: t=<unix-timestamp>,v1=<hmac-sha256-hex>
 *
 * De te ondertekenen boodschap is: `<timestamp>.<raw-request-body>`
 */
function verifyWebhookSignature(
  signatureHeader: string,
  rawBody: string
): boolean {
  if (!SIGNING_KEY) {
    // Geen sleutel geconfigureerd — verificatie overgeslagen
    return true;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key, rest.join("=")];
    })
  );

  const timestamp = parts["t"];
  const receivedSignature = parts["v1"];

  if (!timestamp || !receivedSignature) {
    return false;
  }

  const signingPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", SIGNING_KEY)
    .update(signingPayload, "utf8")
    .digest("hex");

  // Gebruik timingSafeEqual om timing-aanvallen te voorkomen
  try {
    return timingSafeEqual(
      Buffer.from(receivedSignature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await request.text();

    // ── Handtekening verificatie (wanneer sleutel is geconfigureerd) ──────────
    const signatureHeader = request.headers.get("Calendly-Webhook-Signature");

    if (SIGNING_KEY) {
      if (!signatureHeader) {
        console.warn("[Calendly Webhook] Handtekening-header ontbreekt.");
        return NextResponse.json(
          { foutmelding: "Handtekening-header ontbreekt." },
          { status: 401 }
        );
      }

      if (!verifyWebhookSignature(signatureHeader, rawBody)) {
        console.warn("[Calendly Webhook] Ongeldige handtekening ontvangen.");
        return NextResponse.json(
          { foutmelding: "Ongeldige handtekening." },
          { status: 401 }
        );
      }
    }

    // ── Event verwerken ───────────────────────────────────────────────────────
    let webhookEvent: CalendlyWebhookEvent;

    try {
      webhookEvent = JSON.parse(rawBody) as CalendlyWebhookEvent;
    } catch {
      console.error("[Calendly Webhook] Ongeldig JSON-body ontvangen.");
      return NextResponse.json(
        { foutmelding: "Ongeldig JSON-formaat." },
        { status: 400 }
      );
    }

    const { event, payload } = webhookEvent;
    const { invitee, scheduled_event, event_type } = payload;

    switch (event) {
      case "invitee.created": {
        console.log("[Calendly Webhook] Nieuwe afspraak aangemaakt:", {
          eventType: event_type.name,
          klantNaam: invitee.name,
          klantEmail: invitee.email,
          startTijd: scheduled_event.start_time,
          eindTijd: scheduled_event.end_time,
          locatieType: scheduled_event.location.type,
        });

        // TODO: Sla de afspraak op in Convex, bijv.:
        // await convex.mutation(api.afspraken.aanmaken, {
        //   klantNaam: invitee.name,
        //   klantEmail: invitee.email,
        //   eventTypeNaam: event_type.name,
        //   startTijd: scheduled_event.start_time,
        //   eindTijd: scheduled_event.end_time,
        // });

        break;
      }

      case "invitee.canceled": {
        console.log("[Calendly Webhook] Afspraak geannuleerd:", {
          eventType: event_type.name,
          klantNaam: invitee.name,
          klantEmail: invitee.email,
          startTijd: scheduled_event.start_time,
        });

        // TODO: Markeer de afspraak als geannuleerd in Convex, bijv.:
        // await convex.mutation(api.afspraken.annuleren, {
        //   klantEmail: invitee.email,
        //   startTijd: scheduled_event.start_time,
        // });

        break;
      }

      default: {
        // Onbekend event type — negeer stilzwijgend om forward-compatibiliteit te garanderen
        const onbekendEvent = event as string;
        console.log(`[Calendly Webhook] Onbekend event genegeerd: ${onbekendEvent}`);
        break;
      }
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("[Calendly Webhook] Onverwachte fout:", error);

    return NextResponse.json(
      { foutmelding: "Interne serverfout." },
      { status: 500 }
    );
  }
}
