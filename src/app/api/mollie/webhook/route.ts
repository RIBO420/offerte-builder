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

const MOLLIE_API = "https://api.mollie.com/v2";

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

  let paymentId: string | null = null;

  try {
    // Mollie stuurt een application/x-www-form-urlencoded body met het betaling-ID
    const formData = await request.formData();
    paymentId = formData.get("id") as string | null;
  } catch {
    // Fallback: probeer JSON body te lezen
    try {
      const json = (await request.json()) as { id?: string };
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
  // Voorbeeld (wanneer Convex HTTP actions beschikbaar zijn):
  //
  // await fetch(`${process.env.NEXT_PUBLIC_CONVEX_URL}/api/betalingen/updateStatus`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     molliePaymentId: payment.id,
  //     status: payment.status,
  //     updatedAt: Date.now(),
  //   }),
  // });

  // Mollie verwacht altijd een 200 OK response
  return new NextResponse("OK", { status: 200 });
}
