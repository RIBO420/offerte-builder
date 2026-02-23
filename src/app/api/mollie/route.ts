/**
 * Mollie Betalingen API Route
 *
 * POST /api/mollie — Maak een Mollie betaling aan
 *
 * Bedrag moet worden meegegeven als:
 * { currency: "EUR", value: "10.00" } (altijd 2 decimalen, als string)
 */

import { NextRequest, NextResponse } from "next/server";

// Mollie API v2 base URL
const MOLLIE_API = "https://api.mollie.com/v2";

interface MollieAmount {
  currency: "EUR";
  value: string; // bijv. "10.00"
}

interface BetalingMetadata {
  referentie: string;
  klantNaam: string;
  klantEmail: string;
  type: "aanbetaling" | "configurator" | "factuur";
  [key: string]: string;
}

interface MolliePaymentRequest {
  amount: MollieAmount;
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  metadata: BetalingMetadata;
}

interface MolliePaymentResponse {
  id: string;
  status: string;
  _links?: {
    checkout?: {
      href: string;
    };
  };
  detail?: string;
  title?: string;
}

/**
 * Valideer het Mollie bedrag — moet een string zijn met exact 2 decimalen.
 */
function isValidBedrag(value: string): boolean {
  return /^\d+\.\d{2}$/.test(value);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Mollie niet geconfigureerd" },
      { status: 500 }
    );
  }

  let body: MolliePaymentRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ongeldig verzoek: geen geldige JSON" },
      { status: 400 }
    );
  }

  // Validatie van verplichte velden
  if (!body.amount?.currency || !body.amount?.value) {
    return NextResponse.json(
      { error: "Bedrag is verplicht (currency en value)" },
      { status: 400 }
    );
  }

  if (body.amount.currency !== "EUR") {
    return NextResponse.json(
      { error: "Alleen euro's (EUR) worden ondersteund" },
      { status: 400 }
    );
  }

  if (!isValidBedrag(body.amount.value)) {
    return NextResponse.json(
      { error: "Bedrag moet een geldig eurobedrag zijn, bijv. '10.00'" },
      { status: 400 }
    );
  }

  if (!body.description?.trim()) {
    return NextResponse.json(
      { error: "Omschrijving is verplicht" },
      { status: 400 }
    );
  }

  if (!body.redirectUrl?.trim()) {
    return NextResponse.json(
      { error: "Redirect URL is verplicht" },
      { status: 400 }
    );
  }

  if (!body.metadata?.referentie || !body.metadata?.klantNaam) {
    return NextResponse.json(
      { error: "Metadata met referentie en klantNaam is verplicht" },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const webhookUrl =
    body.webhookUrl ||
    (appUrl ? `${appUrl}/api/mollie/webhook` : undefined);

  try {
    const mollieResponse = await fetch(`${MOLLIE_API}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: body.amount,
        description: body.description,
        redirectUrl: body.redirectUrl,
        ...(webhookUrl ? { webhookUrl } : {}),
        metadata: body.metadata,
      }),
    });

    const payment = (await mollieResponse.json()) as MolliePaymentResponse;

    if (!mollieResponse.ok) {
      console.error("[mollie] Fout bij aanmaken betaling:", {
        status: mollieResponse.status,
        detail: payment.detail,
        title: payment.title,
      });
      return NextResponse.json(
        {
          error: payment.detail || "Fout bij aanmaken Mollie betaling",
        },
        { status: mollieResponse.status }
      );
    }

    return NextResponse.json({
      paymentId: payment.id,
      checkoutUrl: payment._links?.checkout?.href,
      status: payment.status,
    });
  } catch (err) {
    console.error("[mollie] Onverwachte fout:", err);
    return NextResponse.json(
      { error: "Fout bij communicatie met Mollie" },
      { status: 500 }
    );
  }
}
