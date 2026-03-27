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
 * See: https://resend.com/docs/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

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
    console.warn(
      "[resend/webhook] Timestamp outside tolerance window:",
      { received: timestampSeconds, now, diff: Math.abs(now - timestampSeconds) }
    );
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
    console.error(
      "[resend/webhook] RESEND_WEBHOOK_SECRET niet geconfigureerd — " +
        "webhook wordt afgewezen. Stel deze omgevingsvariabele in " +
        "om email tracking te activeren."
    );
    // Return 200 to prevent Resend from retrying endlessly
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  // ── Read and verify the request ──────────────────────────────────────

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[resend/webhook] Svix headers ontbreken");
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
    console.warn("[resend/webhook] Ongeldige webhook-handtekening ontvangen");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // ── Parse the event ──────────────────────────────────────────────────

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody) as ResendWebhookEvent;
  } catch {
    console.error("[resend/webhook] Kan JSON niet verwerken");
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // Check if this is a supported event type
  if (
    !SUPPORTED_EVENT_TYPES.includes(event.type as ResendEventType)
  ) {
    // Acknowledge unsupported events without processing
    console.info(
      `[resend/webhook] Niet-ondersteund event type genegeerd: ${event.type}`
    );
    return new NextResponse("OK", { status: 200 });
  }

  const eventType = event.type as ResendEventType;
  const resendId = event.data.email_id;
  const timestamp = new Date(event.created_at).getTime();

  if (!resendId) {
    console.warn("[resend/webhook] Geen email_id in event data");
    return new NextResponse("OK", { status: 200 });
  }

  // ── Update Convex ────────────────────────────────────────────────────

  try {
    const client = getConvexClient();

    await client.mutation(api.emailLogs.updateFromWebhook, {
      resendId,
      eventType,
      timestamp,
    });

    console.info("[resend/webhook] Email status bijgewerkt:", {
      resendId,
      eventType,
      to: event.data.to,
    });
  } catch (error) {
    // Log the error but still return 200 to prevent Resend from retrying
    // for known issues (e.g., resendId not found in our logs)
    console.error("[resend/webhook] Fout bij verwerking:", {
      resendId,
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return new NextResponse("OK", { status: 200 });
}
