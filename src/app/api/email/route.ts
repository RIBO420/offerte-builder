import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { OfferteEmail } from "@/components/email/offerte-email";
import {
  emailRateLimiter,
  getRequestIdentifier,
  createRateLimitResponse,
} from "@/lib/rate-limiter";

// Lazy initialization to avoid build-time errors when API key is not set
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: max 10 emails per minute per user/IP
    const identifier = getRequestIdentifier(request);
    const rateLimitInfo = emailRateLimiter.check(identifier);

    if (!rateLimitInfo.allowed) {
      return createRateLimitResponse(emailRateLimiter, rateLimitInfo);
    }

    const body = await request.json();

    const {
      type,
      to,
      klantNaam,
      offerteNummer,
      totaalInclBtw,
      bedrijfsnaam,
      bedrijfsEmail,
      bedrijfsTelefoon,
      offerteType,
      scopes,
    } = body;

    // Validate required fields
    if (!to?.trim() || !klantNaam?.trim() || !offerteNummer?.trim() || !bedrijfsnaam?.trim()) {
      return NextResponse.json(
        { error: "Ontbrekende verplichte velden" },
        { status: 400 }
      );
    }

    // Define email subjects
    const subjects: Record<string, string> = {
      offerte_verzonden: `Offerte ${offerteNummer} - ${bedrijfsnaam}`,
      herinnering: `Herinnering: Offerte ${offerteNummer} - ${bedrijfsnaam}`,
      bedankt: `Bedankt voor uw opdracht - ${bedrijfsnaam}`,
    };

    const subject = subjects[type] || `Offerte ${offerteNummer}`;

    // Render email HTML
    const emailHtml = await render(
      OfferteEmail({
        type,
        klantNaam,
        offerteNummer,
        totaalInclBtw,
        bedrijfsnaam,
        bedrijfsEmail,
        bedrijfsTelefoon,
        offerteType,
        scopes,
      })
    );

    // Send email via Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@toptuinen.nl";

    let resend: Resend;
    try {
      resend = getResendClient();
    } catch {
      return NextResponse.json(
        { error: "E-mail service niet geconfigureerd", status: "mislukt" },
        { status: 503 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: `${bedrijfsnaam} <${fromEmail}>`,
      to: [to],
      subject,
      html: emailHtml,
      // Reply-to the business email if provided
      replyTo: bedrijfsEmail || undefined,
    });

    if (error) {
      return NextResponse.json(
        { error: error?.message || "Email delivery failed", status: "mislukt" },
        { status: 500 }
      );
    }

    // Include rate limit headers in successful response
    const rateLimitHeaders = emailRateLimiter.getHeaders(rateLimitInfo);
    return NextResponse.json(
      {
        success: true,
        resendId: data?.id,
        status: "verzonden",
        subject,
      },
      {
        headers: rateLimitHeaders,
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Fout bij verzenden email", status: "mislukt" },
      { status: 500 }
    );
  }
}
