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
 * TODO(afspraken): sla afspraakinformatie op in Convex. Nu wordt een geldig
 * ondertekend event stilzwijgend weggegooid — er gaat dus data verloren.
 * Geblokkeerd — er is nog geen `afspraken`-tabel in convex/schema.ts.
 * `serviceAfspraken` lijkt erop maar is het niet: die hangt verplicht aan een
 * `servicemeldingen`-record en aan `medewerkerIds`, terwijl een Calendly-boeking
 * van een nog onbekende websitebezoeker komt. Zie het auditrapport (§5, K4) voor
 * het voorstel: tabel + indexen + een via `CONVEX_WEBHOOK_SECRET` beveiligde
 * `aanmaken`/`annuleren`-mutation.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

import type { CalendlyWebhookEvent } from "@/lib/calendly";
import { logger } from "@/lib/logger";

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
    logger.error(
      "CALENDLY_WEBHOOK_SIGNING_KEY niet geconfigureerd — webhook wordt afgewezen",
      undefined,
      { module: "calendly/webhook" }
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
      logger.error(
        "CALENDLY_WEBHOOK_SIGNING_KEY niet geconfigureerd — alle webhooks worden afgewezen",
        undefined,
        { module: "calendly/webhook" }
      );
      return NextResponse.json(
        { foutmelding: "Webhook niet geconfigureerd." },
        { status: 503 }
      );
    }

    const signatureHeader = request.headers.get("Calendly-Webhook-Signature");

    if (!signatureHeader) {
      logger.warn("Handtekening-header ontbreekt", {
        module: "calendly/webhook",
      });
      return NextResponse.json(
        { foutmelding: "Handtekening-header ontbreekt." },
        { status: 401 }
      );
    }

    if (!verifyWebhookSignature(signatureHeader, rawBody)) {
      logger.warn("Ongeldige handtekening ontvangen", {
        module: "calendly/webhook",
      });
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
      logger.error("Ongeldig JSON-body ontvangen", undefined, {
        module: "calendly/webhook",
      });
      return NextResponse.json(
        { foutmelding: "Ongeldig JSON-formaat." },
        { status: 400 }
      );
    }

    const { event } = webhookEvent;

    switch (event) {
      case "invitee.created": {
        // TODO(afspraken): `api.afspraken.aanmaken` bestaat nog niet — zie de
        // blokkade bovenaan dit bestand. De payload levert alles wat de tabel
        // nodig heeft: payload.invitee.{name,email},
        // payload.scheduled_event.{start_time,end_time,location.type} en
        // payload.event_type.{name,slug}.
        break;
      }

      case "invitee.canceled": {
        // TODO(afspraken): `api.afspraken.annuleren` bestaat nog niet — zie de
        // blokkade bovenaan dit bestand. Annuleren moet de bestaande afspraak
        // opzoeken; Calendly stuurt in dit event geen eigen id mee in
        // `CalendlyWebhookEvent`, dus de sleutel wordt
        // (invitee.email + scheduled_event.start_time). Voeg bij voorkeur
        // `payload.uri` toe aan het type en gebruik dat als stabiele sleutel.
        break;
      }

      default: {
        // Onbekend event type — negeer stilzwijgend om forward-compatibiliteit te garanderen
        break;
      }
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    logger.error("Onverwachte fout bij verwerken Calendly-webhook", error, {
      module: "calendly/webhook",
    });

    return NextResponse.json(
      { foutmelding: "Interne serverfout." },
      { status: 500 }
    );
  }
}
