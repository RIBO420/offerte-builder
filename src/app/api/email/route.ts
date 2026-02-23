import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { OfferteEmail } from "@/components/email/offerte-email";
import {
  BevestigingEmail,
  type BevestigingEmailProps,
} from "@/components/email/bevestiging-email";
import {
  emailRateLimiter as inMemoryEmailRateLimiter,
  getRequestIdentifier as getInMemoryRequestIdentifier,
  createRateLimitResponse as createInMemoryRateLimitResponse,
} from "@/lib/rate-limiter";
import {
  isUpstashConfigured,
  getEmailRateLimiter,
  checkRateLimit as checkUpstashRateLimit,
  createUpstashRateLimitResponse,
  getRateLimitHeaders,
  getRequestIdentifier as getUpstashRequestIdentifier,
} from "@/lib/upstash-rate-limiter";

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
    // Rate limiting: Use Upstash if configured, otherwise fall back to in-memory
    const useUpstash = isUpstashConfigured();
    let rateLimitPassed = false;
    let upstashRateLimitResult: Awaited<
      ReturnType<typeof checkUpstashRateLimit>
    > | null = null;
    let inMemoryRateLimitInfo: ReturnType<
      typeof inMemoryEmailRateLimiter.check
    > | null = null;

    if (useUpstash) {
      // Upstash Redis-based rate limiting (5 emails per hour)
      const identifier = getUpstashRequestIdentifier(request);
      try {
        upstashRateLimitResult = await checkUpstashRateLimit(
          getEmailRateLimiter(),
          identifier
        );
        rateLimitPassed = upstashRateLimitResult.success;

        if (!rateLimitPassed) {
          return createUpstashRateLimitResponse(upstashRateLimitResult);
        }
      } catch (upstashError) {
        // If Upstash fails, fall back to in-memory rate limiting
        console.warn(
          "Upstash rate limiting failed, falling back to in-memory:",
          upstashError
        );
        const fallbackIdentifier = getInMemoryRequestIdentifier(request);
        inMemoryRateLimitInfo =
          inMemoryEmailRateLimiter.check(fallbackIdentifier);
        rateLimitPassed = inMemoryRateLimitInfo.allowed;

        if (!rateLimitPassed) {
          return createInMemoryRateLimitResponse(
            inMemoryEmailRateLimiter,
            inMemoryRateLimitInfo
          );
        }
      }
    } else {
      // In-memory rate limiting (10 emails per minute per user/IP)
      const identifier = getInMemoryRequestIdentifier(request);
      inMemoryRateLimitInfo = inMemoryEmailRateLimiter.check(identifier);
      rateLimitPassed = inMemoryRateLimitInfo.allowed;

      if (!rateLimitPassed) {
        return createInMemoryRateLimitResponse(
          inMemoryEmailRateLimiter,
          inMemoryRateLimitInfo
        );
      }
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
      // Bevestiging-specific fields
      aanvraagType,
      aanvraagDetails,
      datumOpties,
      calendlyUrl,
      bedrijfsAdres,
    } = body;

    // Validate required fields
    if (!to?.trim() || !klantNaam?.trim() || !bedrijfsnaam?.trim()) {
      return NextResponse.json(
        { error: "Ontbrekende verplichte velden" },
        { status: 400 }
      );
    }

    // Bevestiging email type: separate validation and rendering path
    if (type === "bevestiging") {
      if (!aanvraagType) {
        return NextResponse.json(
          { error: "aanvraagType is verplicht voor bevestigingsmails" },
          { status: 400 }
        );
      }

      const bevestigingProps: BevestigingEmailProps = {
        klantNaam,
        aanvraagType,
        aanvraagDetails: aanvraagDetails ?? undefined,
        datumOpties: Array.isArray(datumOpties) ? datumOpties : [],
        calendlyUrl: calendlyUrl ?? undefined,
        bedrijfsnaam,
        bedrijfsEmail: bedrijfsEmail ?? "",
        bedrijfsTelefoon: bedrijfsTelefoon ?? "",
        bedrijfsAdres: bedrijfsAdres ?? undefined,
      };

      const subject = `Uw aanvraag bij ${bedrijfsnaam} — bevestiging`;

      const emailHtml = await render(BevestigingEmail(bevestigingProps));

      const fromEmail =
        process.env.RESEND_FROM_EMAIL || "noreply@toptuinen.nl";

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
        replyTo: bedrijfsEmail || undefined,
      });

      if (error) {
        console.error("[emailLogs] bevestiging mislukt:", {
          to,
          klantNaam,
          aanvraagType,
          error: error.message,
        });
        return NextResponse.json(
          {
            error: error?.message || "Email delivery failed",
            status: "mislukt",
          },
          { status: 500 }
        );
      }

      console.info("[emailLogs] bevestiging verzonden:", {
        to,
        klantNaam,
        aanvraagType,
        resendId: data?.id,
        subject,
      });

      const rateLimitHeaders = upstashRateLimitResult
        ? getRateLimitHeaders(upstashRateLimitResult)
        : inMemoryRateLimitInfo
          ? inMemoryEmailRateLimiter.getHeaders(inMemoryRateLimitInfo)
          : {};

      return NextResponse.json(
        {
          success: true,
          resendId: data?.id,
          status: "verzonden",
          subject,
        },
        { headers: rateLimitHeaders }
      );
    }

    // Offerte email types: validate offerte-specific required fields
    if (!offerteNummer?.trim()) {
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
    const rateLimitHeaders = upstashRateLimitResult
      ? getRateLimitHeaders(upstashRateLimitResult)
      : inMemoryRateLimitInfo
        ? inMemoryEmailRateLimiter.getHeaders(inMemoryRateLimitInfo)
        : {};

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
