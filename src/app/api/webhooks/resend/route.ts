/**
 * Resend Webhook Route
 *
 * POST /api/webhooks/resend
 *
 * Receives Resend webhook events for email open/click/bounce tracking.
 * Verifies the webhook signature using Svix headers (HMAC), then updates
 * the corresponding email_logs entry in Convex.
 *
 * Resend uses Svix for webhook delivery. The signature is verified using
 * the `svix-id`, `svix-timestamp`, and `svix-signature` headers.
 *
 * Twee lagen beveiliging, allebei nodig:
 *  1. RESEND_WEBHOOK_SECRET — Svix-handtekening; bewijst dat het event
 *     daadwerkelijk van Resend komt.
 *  2. CONVEX_WEBHOOK_SECRET — gedeeld geheim dat we meesturen naar
 *     `emailLogs.updateFromWebhook`. Die Convex-mutation is een publiek
 *     endpoint (een internalMutation is niet aanroepbaar via
 *     ConvexHttpClient), dus zonder dit geheim kon iedereen die de
 *     deployment-URL kent e-mailstatussen vervalsen.
 *
 * See: https://resend.com/docs/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { logger } from "@/lib/logger";

// ── Convex client (lazy init) ─────────────────────────────────────────────

let convexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
    }
    convexClient = new ConvexHttpClient(url);
  }
  return convexClient;
}

// ── Types ─────────────────────────────────────────────────────────────────

const SUPPORTED_EVENT_TYPES = [
  "email.delivered",
  "email.opened",
  "email.bounced",
  "email.clicked",
  "email.complained",
] as const;

type ResendEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
  };
}

// ── Svix signature verification ───────────────────────────────────────────

/**
 * Verifies the Svix webhook signature.
 *
 * Svix signs webhooks with a secret key using HMAC-SHA256. The signature
 * is sent in the `svix-signature` header as a list of versioned signatures
 * (e.g., "v1,<base64>"). The message to sign is: "${msgId}.${timestamp}.${body}".
 *
 * The secret key from Resend starts with "whsec_" prefix followed by
 * a base64-encoded key.
 */
function verifyWebhookSignature(
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  rawBody: string,
  secret: string
): boolean {
  // Validate timestamp is within tolerance (5 minutes)
  const timestampSeconds = parseInt(svixTimestamp, 10);
  if (isNaN(timestampSeconds)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  const tolerance = 5 * 60; // 5 minutes

  if (Math.abs(now - timestampSeconds) > tolerance) {
    logger.warn("Timestamp valt buiten het toegestane tijdvenster", {
      module: "resend/webhook",
      ontvangen: timestampSeconds,
      nu: now,
      verschil: Math.abs(now - timestampSeconds),
    });
    return false;
  }

  // Decode the secret key (strip "whsec_" prefix, base64 decode)
  const secretKey = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret, "base64");

  // Build the signed content: "${svixId}.${svixTimestamp}.${rawBody}"
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

  // Compute the expected signature
  const expectedSignature = createHmac("sha256", secretKey)
    .update(signedContent, "utf8")
    .digest("base64");

  // Svix sends multiple signatures separated by spaces, each prefixed with "v1,"
  const signatures = svixSignature.split(" ");

  for (const versionedSig of signatures) {
    const [version, signature] = versionedSig.split(",", 2);
    if (version !== "v1" || !signature) continue;

    try {
      const sigBuffer = Buffer.from(signature, "base64");
      const expectedBuffer = Buffer.from(expectedSignature, "base64");

      if (
        sigBuffer.length === expectedBuffer.length &&
        timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        return true;
      }
    } catch {
      // Invalid base64 or buffer length mismatch — try next signature
      continue;
    }
  }

  return false;
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error(
      "RESEND_WEBHOOK_SECRET niet geconfigureerd — webhook wordt afgewezen",
      undefined,
      { module: "resend/webhook" }
    );
    // Bewust 500 en geen 200: dit is een configuratiefout aan onze kant, geen
    // afgehandeld event. Resend blijft retryen, zodat de statusupdates alsnog
    // binnenkomen zodra het geheim gezet is in plaats van stil te verdwijnen.
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  // Zonder dit geheim weigert de Convex-mutation de update. Hier al afvangen
  // in plaats van verderop in de try/catch: die slikt fouten en antwoordt 200,
  // waardoor een configuratiefout onzichtbaar zou blijven.
  const convexWebhookSecret = process.env.CONVEX_WEBHOOK_SECRET;

  if (!convexWebhookSecret) {
    logger.error(
      "CONVEX_WEBHOOK_SECRET niet geconfigureerd — email-statusupdates worden geweigerd door Convex",
      undefined,
      { module: "resend/webhook" }
    );
    return new NextResponse("Convex webhook secret not configured", {
      status: 500,
    });
  }

  // ── Read and verify the request ──────────────────────────────────────

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn("Svix headers ontbreken", { module: "resend/webhook" });
    return new NextResponse("Missing webhook signature headers", {
      status: 401,
    });
  }

  const rawBody = await request.text();

  if (
    !verifyWebhookSignature(
      svixId,
      svixTimestamp,
      svixSignature,
      rawBody,
      webhookSecret
    )
  ) {
    logger.warn("Ongeldige webhook-handtekening ontvangen", {
      module: "resend/webhook",
    });
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // ── Parse the event ──────────────────────────────────────────────────

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    logger.error("Kan JSON niet verwerken", undefined, {
      module: "resend/webhook",
    });
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // Check if this is a supported event type
  if (
    !SUPPORTED_EVENT_TYPES.includes(event.type as ResendEventType)
  ) {
    // Acknowledge unsupported events without processing
    logger.debug("Niet-ondersteund event type genegeerd", {
      module: "resend/webhook",
      eventType: event.type,
    });
    return new NextResponse("OK", { status: 200 });
  }

  const eventType = event.type as ResendEventType;
  const resendId = event.data.email_id;
  const timestamp = new Date(event.created_at).getTime();

  if (!resendId) {
    logger.warn("Geen email_id in event data", { module: "resend/webhook" });
    return new NextResponse("OK", { status: 200 });
  }

  // ── Update Convex ────────────────────────────────────────────────────

  try {
    const client = getConvexClient();

    await client.mutation(api.emailLogs.updateFromWebhook, {
      secret: convexWebhookSecret,
      resendId,
      eventType,
      timestamp,
    });

    logger.info("Emailstatus bijgewerkt", {
      module: "resend/webhook",
      resendId,
      eventType,
      ontvanger: event.data.to,
    });
  } catch (error) {
    const melding = error instanceof Error ? error.message : String(error);

    logger.error("Fout bij verwerken van Resend-webhook", error, {
      module: "resend/webhook",
      resendId,
      eventType,
    });

    // Een verkeerd of ontbrekend CONVEX_WEBHOOK_SECRET aan de Convex-kant is
    // een configuratiefout, geen "event dat we mogen laten vallen". Met een 200
    // zou Resend niet opnieuw proberen en zouden alle statusupdates stilzwijgend
    // verdwijnen — alleen zichtbaar in de logregel hierboven. 500 laat Resend
    // retryen, zodat de events er alsnog zijn zodra het geheim klopt.
    if (
      melding.includes("webhook-geheim") ||
      melding.includes("CONVEX_WEBHOOK_SECRET")
    ) {
      return new NextResponse("Convex webhook secret mismatch", { status: 500 });
    }

    // Overige fouten (bijv. een resendId dat niet in onze logs staat) leveren
    // bewust 200 op: retryen lost die niet op.
  }

  return new NextResponse("OK", { status: 200 });
}
