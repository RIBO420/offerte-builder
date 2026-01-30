import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { OfferteEmail } from "@/components/email/offerte-email";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
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
    if (!to || !klantNaam || !offerteNummer || !bedrijfsnaam) {
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
    // Note: Using onboarding@resend.dev as "from" address for testing
    // In production, you need to verify your own domain
    const { data, error } = await resend.emails.send({
      from: `${bedrijfsnaam} <onboarding@resend.dev>`,
      to: [to],
      subject,
      html: emailHtml,
      // Reply-to the business email if provided
      replyTo: bedrijfsEmail || undefined,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message, status: "mislukt" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      resendId: data?.id,
      status: "verzonden",
      subject,
    });
  } catch {
    return NextResponse.json(
      { error: "Fout bij verzenden email", status: "mislukt" },
      { status: 500 }
    );
  }
}
