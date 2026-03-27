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
    // Geen sleutel geconfigureerd — verzoeken worden afgewezen
    console.error(
      "[Calendly Webhook] CALENDLY_WEBHOOK_SIGNING_KEY niet geconfigureerd — webhook wordt afgewezen. " +
      "Stel deze omgevingsvariabele in om webhooks te verwerken."
    );
    return false;
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

    // ── Handtekening verificatie (verplicht) ─────────────────────────────────
    if (!SIGNING_KEY) {
      console.error(
        "[Calendly Webhook] CALENDLY_WEBHOOK_SIGNING_KEY niet geconfigureerd — " +
        "alle webhooks worden afgewezen. Stel deze omgevingsvariabele in."
      );
      return NextResponse.json(
        { foutmelding: "Webhook niet geconfigureerd." },
        { status: 503 }
      );
    }

    const signatureHeader = request.headers.get("Calendly-Webhook-Signature");

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
        // TODO: Sla de afspraak op in Convex (api.afspraken.aanmaken)
        break;
      }

      case "invitee.canceled": {
        // TODO: Markeer de afspraak als geannuleerd in Convex (api.afspraken.annuleren)
        break;
      }

      default: {
        // Onbekend event type — negeer stilzwijgend om forward-compatibiliteit te garanderen
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
