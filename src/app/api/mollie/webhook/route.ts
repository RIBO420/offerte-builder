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
import { logger } from "@/lib/logger";

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
    logger.error(
      "MOLLIE_WEBHOOK_SIGNING_KEY niet geconfigureerd — webhook wordt afgewezen",
      undefined,
      { module: "mollie/webhook" }
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
      logger.error("Kan betaling niet ophalen bij Mollie", undefined, {
        module: "mollie/webhook",
        paymentId,
        status: response.status,
      });
      return null;
    }

    return (await response.json()) as MolliePaymentDetail;
  } catch (err) {
    logger.error("Fout bij ophalen betaling bij Mollie", err, {
      module: "mollie/webhook",
      paymentId,
    });
    return null;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) {
    logger.error("MOLLIE_API_KEY niet geconfigureerd", undefined, {
      module: "mollie/webhook",
    });
    // Mollie verwacht altijd een 200 OK, anders herprobeert het de webhook
    return new NextResponse("OK", { status: 200 });
  }

  // ── Handtekening verificatie (HMAC-SHA256) ──────────────────────────────
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("webhook-signing");

  if (!signatureHeader) {
    logger.warn("Handtekening-header ontbreekt", { module: "mollie/webhook" });
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!verifyWebhookSignature(signatureHeader, rawBody)) {
    logger.warn("Ongeldige handtekening ontvangen", {
      module: "mollie/webhook",
    });
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
      logger.error("Kan request body niet verwerken", undefined, {
        module: "mollie/webhook",
      });
      return new NextResponse("OK", { status: 200 });
    }
  }

  if (!paymentId) {
    logger.warn("Geen betaling-ID ontvangen", { module: "mollie/webhook" });
    return new NextResponse("OK", { status: 200 });
  }

  // Haal de actuele betalingstatus op van Mollie
  const payment = await getMolliePayment(paymentId, apiKey);

  if (!payment) {
    return new NextResponse("OK", { status: 200 });
  }

  // Zolang de TODO hieronder openstaat is deze logregel het énige spoor van de
  // betalingsstatus — er wordt nog niets naar Convex weggeschreven. Daarom
  // gestructureerd naar Sentry en niet naar een vluchtige stdout-console.
  logger.info("Betalingsstatus ontvangen van Mollie", {
    module: "mollie/webhook",
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

  // TODO(betalingen): schrijf `payment.status` weg naar de `betalingen`-tabel.
  //
  // Geblokkeerd — er is nog geen mutation die vanuit deze route aanroepbaar is.
  // `betalingen.updateStatus` bestaat wél en doet precies het goede (zoekt op
  // de `by_mollieId`-index en patcht status + updatedAt), maar begint met
  // `requireNotViewer(ctx)`. Die vereist een Clerk-identiteit via `ctx.auth`,
  // en een webhook heeft er geen: Mollie roept ons aan, geen ingelogde
  // gebruiker. Een `ConvexHttpClient` zonder token faalt dus met een AuthError.
  //
  // Benodigd: `betalingen.updateStatusFromWebhook` — een publieke mutation die
  // in plaats van `requireNotViewer` een gedeeld geheim controleert
  // (`CONVEX_WEBHOOK_SECRET`), exact zoals `emailLogs.updateFromWebhook` dat
  // doet. Een `internalMutation` kan hier niet: die is niet aanroepbaar via
  // `ConvexHttpClient`. Zie src/app/api/webhooks/resend/route.ts voor het
  // volledige patroon (lazy client + geheim meesturen + foutafhandeling).
  //
  // Zodra die mutation er is, hier aanroepen met { molliePaymentId: payment.id,
  // status: payment.status, webhookSecret } — de statuswaarden van Mollie
  // komen één-op-één overeen met `betalingStatusValidator` in convex/betalingen.ts.

  // Mollie verwacht altijd een 200 OK response
  return new NextResponse("OK", { status: 200 });
}
