/**
 * Mollie Webhook Route
 *
 * POST /api/mollie/webhook
 *
 * Mollie stuurt een POST request met het betaling-ID wanneer de status
 * van een betaling verandert. Vervolgens halen we de actuele betalingstatus
 * op via de Mollie API en loggen dit.
 *
 * Zie: https://docs.mollie.com/docs/webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const MOLLIE_API = "https://api.mollie.com/v2";
const WEBHOOK_SIGNING_KEY = process.env.MOLLIE_WEBHOOK_SIGNING_KEY;

interface MolliePaymentDetail {
  id: string;
  status: "open" | "pending" | "paid" | "failed" | "expired" | "canceled";
  amount: {
    currency: string;
    value: string;
  };
  description: string;
  metadata?: Record<string, string>;
  paidAt?: string;
  failedAt?: string;
  expiredAt?: string;
  canceledAt?: string;
}

/**
 * Verifieert de Mollie webhook-handtekening (HMAC-SHA256).
 *
 * Mollie stuurt de handtekening mee als "webhook-signing" header.
 * De te ondertekenen boodschap is de rauwe request body.
 */
function verifyWebhookSignature(
  signatureHeader: string,
  rawBody: string
): boolean {
  if (!WEBHOOK_SIGNING_KEY) {
    // Geen sleutel geconfigureerd — verzoeken worden afgewezen in productie
    console.error(
      "[mollie/webhook] MOLLIE_WEBHOOK_SIGNING_KEY niet geconfigureerd — webhook wordt afgewezen. " +
        "Stel deze omgevingsvariabele in om webhooks te verwerken."
    );
    return false;
  }

  const expectedSignature = createHmac("sha256", WEBHOOK_SIGNING_KEY)
    .update(rawBody, "utf8")
    .digest("hex");

  // Gebruik timingSafeEqual om timing-aanvallen te voorkomen
  try {
    return timingSafeEqual(
      Buffer.from(signatureHeader, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Haal betalingsdetails op van de Mollie API.
 */
async function getMolliePayment(
  paymentId: string,
  apiKey: string
): Promise<MolliePaymentDetail | null> {
  try {
    const response = await fetch(`${MOLLIE_API}/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error("[mollie/webhook] Kan betaling niet ophalen:", {
        paymentId,
        status: response.status,
      });
      return null;
    }

    return (await response.json()) as MolliePaymentDetail;
  } catch (err) {
    console.error("[mollie/webhook] Fout bij ophalen betaling:", err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) {
    console.error("[mollie/webhook] MOLLIE_API_KEY niet geconfigureerd");
    // Mollie verwacht altijd een 200 OK, anders herprobeert het de webhook
    return new NextResponse("OK", { status: 200 });
  }

  // ── Handtekening verificatie (HMAC-SHA256) ──────────────────────────────
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("webhook-signing");

  if (!signatureHeader) {
    console.warn("[mollie/webhook] Handtekening-header ontbreekt.");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!verifyWebhookSignature(signatureHeader, rawBody)) {
    console.warn("[mollie/webhook] Ongeldige handtekening ontvangen.");
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // ── Body verwerken ──────────────────────────────────────────────────────
  let paymentId: string | null = null;

  try {
    // Mollie stuurt een application/x-www-form-urlencoded body met het betaling-ID
    const params = new URLSearchParams(rawBody);
    paymentId = params.get("id");
  } catch {
    // Fallback: probeer JSON body te lezen
    try {
      const json = JSON.parse(rawBody) as { id?: string };
      paymentId = json.id ?? null;
    } catch {
      console.error("[mollie/webhook] Kan request body niet verwerken");
      return new NextResponse("OK", { status: 200 });
    }
  }

  if (!paymentId) {
    console.warn("[mollie/webhook] Geen betaling-ID ontvangen");
    return new NextResponse("OK", { status: 200 });
  }

  // Haal de actuele betalingstatus op van Mollie
  const payment = await getMolliePayment(paymentId, apiKey);

  if (!payment) {
    return new NextResponse("OK", { status: 200 });
  }

  // Log de betalingsstatus
  console.info("[mollie/webhook] Betalingsstatus bijgewerkt:", {
    paymentId: payment.id,
    status: payment.status,
    bedrag: `${payment.amount.value} ${payment.amount.currency}`,
    omschrijving: payment.description,
    metadata: payment.metadata,
    ...(payment.paidAt ? { betaaldOp: payment.paidAt } : {}),
    ...(payment.failedAt ? { misluktOp: payment.failedAt } : {}),
    ...(payment.expiredAt ? { verlopenOp: payment.expiredAt } : {}),
    ...(payment.canceledAt ? { geannuleerdOp: payment.canceledAt } : {}),
  });

  // TODO: Update betalingsstatus in Convex via een server-side action

  // Mollie verwacht altijd een 200 OK response
  return new NextResponse("OK", { status: 200 });
}
