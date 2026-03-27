/**
 * Portal Email Notification Triggers
 *
 * Internal actions that send email notifications to klanten with portal access.
 * Each function looks up the klant, verifies portalEnabled === true, builds
 * an HTML email from a simple template, and sends via the Resend API.
 *
 * These are internalActions so they can make HTTP requests to Resend.
 * They are called by other Convex mutations/actions when portal-relevant
 * events occur (invitation, new offerte, message, factuur, project update).
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ── Helpers ────────────────────────────────────────────────────────────

/** Get the portal base URL from environment */
function getPortalUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    "https://app.toptuinen.nl"
  );
}

/** Get company details from instellingen, with sensible defaults */
async function getBedrijfsgegevens(
  ctx: ActionCtx,
  userId: Id<"users">
): Promise<{
  naam: string;
  email: string;
  telefoon: string;
}> {
  const instellingen = (await ctx.runQuery(
    internal.instellingen.getByUserId,
    { userId }
  )) as Record<string, unknown> | null;

  const bedrijfsgegevens = (instellingen?.bedrijfsgegevens ?? {}) as Record<
    string,
    string
  >;

  return {
    naam: bedrijfsgegevens.naam || "Top Tuinen",
    email: bedrijfsgegevens.email || "",
    telefoon: bedrijfsgegevens.telefoon || "",
  };
}

/**
 * Send an email via the Resend API.
 * Returns the Resend message ID on success, or throws on failure.
 */
async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
  fromName: string;
  replyTo?: string;
}): Promise<string | undefined> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("[portaalEmail] RESEND_API_KEY not configured — skipping send");
    return undefined;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@toptuinen.nl";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${params.fromName} <${fromEmail}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo || undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Resend API error (${response.status}): ${errorText.substring(0, 300)}`
    );
  }

  const result = await response.json();
  return result.id as string | undefined;
}

/**
 * Wrap email content in a branded HTML layout.
 * Follows the same visual style as the React Email templates
 * (green header, white content, gray footer).
 */
function wrapInBrandedLayout(params: {
  bedrijfsNaam: string;
  bedrijfsEmail: string;
  bedrijfsTelefoon: string;
  title: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const ctaHtml = params.ctaUrl
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${params.ctaUrl}" style="background-color:#16a34a;border-radius:6px;color:#ffffff;display:inline-block;font-size:16px;font-weight:600;padding:14px 32px;text-decoration:none;">${params.ctaLabel || "Bekijken"}</a>
      </div>`
    : "";

  const contactParts = [params.bedrijfsNaam];
  if (params.bedrijfsEmail) contactParts.push(`<a href="mailto:${params.bedrijfsEmail}" style="color:#16a34a;text-decoration:none;">${params.bedrijfsEmail}</a>`);
  if (params.bedrijfsTelefoon) contactParts.push(params.bedrijfsTelefoon);

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Ubuntu,sans-serif;margin:0;padding:0;">
  <div style="background-color:#ffffff;margin:0 auto;max-width:600px;">
    <!-- Header -->
    <div style="background-color:#16a34a;padding:24px 32px;">
      <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">${params.bedrijfsNaam}</h1>
    </div>
    <!-- Content -->
    <div style="padding:32px;">
      <h2 style="color:#1f2937;font-size:24px;font-weight:600;margin:0 0 24px;">${params.title}</h2>
      ${params.body}
      ${ctaHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0;">
        Met vriendelijke groet,<br /><strong>${params.bedrijfsNaam}</strong>
      </p>
    </div>
    <!-- Footer -->
    <div style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:24px 32px;">
      <p style="color:#6b7280;font-size:13px;margin:0;text-align:center;">
        ${contactParts.join(" | ")}
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── 1. Send Invitation Email ───────────────────────────────────────────

export const sendInvitation = internalAction({
  args: {
    klantId: v.id("klanten"),
    token: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; resendId?: string; error?: string }> => {
    // Look up klant
    const klant = await ctx.runQuery(internal.klanten.getByIdInternal, {
      klantId: args.klantId,
    });
    if (!klant) {
      console.error(
        `[portaalEmail/sendInvitation] Klant not found: ${args.klantId}`
      );
      return { success: false, error: "klant_not_found" };
    }

    if (!klant.email) {
      console.warn(
        `[portaalEmail/sendInvitation] No email for klant "${klant.naam}"`
      );
      return { success: false, error: "no_email" };
    }

    // Get company details
    const bedrijf = await getBedrijfsgegevens(ctx, klant.userId);

    // Build registration URL
    const registratieUrl = `${getPortalUrl()}/portaal/registreren?token=${args.token}`;

    const html = wrapInBrandedLayout({
      bedrijfsNaam: bedrijf.naam,
      bedrijfsEmail: bedrijf.email,
      bedrijfsTelefoon: bedrijf.telefoon,
      title: "Welkom bij uw klantenportaal",
      body: `
        <p style="color:#374151;font-size:16px;line-height:24px;margin:0 0 16px;">Beste ${klant.naam},</p>
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          U bent uitgenodigd om gebruik te maken van het klantenportaal van ${bedrijf.naam}. Via dit portaal kunt u eenvoudig:
        </p>
        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:16px 0 24px;">
          <p style="color:#166534;font-size:14px;line-height:28px;margin:0;padding-left:8px;">Uw offertes bekijken en goedkeuren</p>
          <p style="color:#166534;font-size:14px;line-height:28px;margin:0;padding-left:8px;">Facturen inzien en downloaden</p>
          <p style="color:#166534;font-size:14px;line-height:28px;margin:0;padding-left:8px;">De voortgang van uw project volgen</p>
          <p style="color:#166534;font-size:14px;line-height:28px;margin:0;padding-left:8px;">Direct berichten sturen naar ons team</p>
        </div>
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          Klik op de onderstaande knop om uw account aan te maken en direct toegang te krijgen.
        </p>
      `,
      ctaUrl: registratieUrl,
      ctaLabel: "Account aanmaken",
    });

    try {
      const resendId = await sendViaResend({
        to: klant.email,
        subject: `Welkom bij het klantenportaal van ${bedrijf.naam}`,
        html,
        fromName: bedrijf.naam,
        replyTo: bedrijf.email,
      });

      console.info("[portaalEmail/sendInvitation] Uitnodiging verzonden:", {
        to: klant.email,
        klantNaam: klant.naam,
        resendId,
      });

      return { success: true, resendId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Onbekende fout";
      console.error(
        "[portaalEmail/sendInvitation] Failed:",
        errorMessage
      );
      return { success: false, error: errorMessage };
    }
  },
});

// ── 2. Send Offerte Notification ───────────────────────────────────────

export const sendOfferteNotification = internalAction({
  args: {
    offerteId: v.id("offertes"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; resendId?: string; error?: string }> => {
    // Look up offerte
    const offerte = await ctx.runQuery(internal.offertes.getByIdInternal, {
      offerteId: args.offerteId,
    });
    if (!offerte) {
      console.error(
        `[portaalEmail/sendOfferteNotification] Offerte not found: ${args.offerteId}`
      );
      return { success: false, error: "offerte_not_found" };
    }

    // Check if klant has portal access
    if (!offerte.klantId) {
      return { success: false, error: "no_klant_linked" };
    }

    const klant = await ctx.runQuery(internal.klanten.getByIdInternal, {
      klantId: offerte.klantId,
    });
    if (!klant) {
      return { success: false, error: "klant_not_found" };
    }

    if (!klant.portalEnabled) {
      return { success: false, error: "portal_not_enabled" };
    }

    if (!klant.email) {
      return { success: false, error: "no_email" };
    }

    // Get company details
    const bedrijf = await getBedrijfsgegevens(ctx, offerte.userId);

    // Build portal URL
    const portaalUrl = `${getPortalUrl()}/portaal/offertes`;

    // Format amount if available
    const bedragStr = offerte.totalen?.totaalInclBtw
      ? new Intl.NumberFormat("nl-NL", {
          style: "currency",
          currency: "EUR",
        }).format(offerte.totalen.totaalInclBtw)
      : undefined;

    const bedragHtml = bedragStr
      ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;" />
         <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 4px;">Bedrag incl. BTW</p>
         <p style="color:#16a34a;font-size:20px;font-weight:700;margin:0;">${bedragStr}</p>`
      : "";

    const html = wrapInBrandedLayout({
      bedrijfsNaam: bedrijf.naam,
      bedrijfsEmail: bedrijf.email,
      bedrijfsTelefoon: bedrijf.telefoon,
      title: "Nieuwe offerte beschikbaar",
      body: `
        <p style="color:#374151;font-size:16px;line-height:24px;margin:0 0 16px;">Beste ${klant.naam},</p>
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          Er staat een nieuwe offerte voor u klaar. Via uw persoonlijke portaal kunt u de offerte inzien, downloaden en direct goedkeuren.
        </p>
        <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 4px;">Offertenummer</p>
          <p style="color:#1f2937;font-size:16px;font-weight:600;margin:0;">${offerte.offerteNummer}</p>
          ${bedragHtml}
        </div>
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          Heeft u vragen over deze offerte? U kunt via het portaal direct een bericht sturen of contact opnemen met ons kantoor.
        </p>
      `,
      ctaUrl: portaalUrl,
      ctaLabel: "Offerte bekijken",
    });

    try {
      const resendId = await sendViaResend({
        to: klant.email,
        subject: `Nieuwe offerte ${offerte.offerteNummer} van ${bedrijf.naam}`,
        html,
        fromName: bedrijf.naam,
        replyTo: bedrijf.email,
      });

      console.info(
        "[portaalEmail/sendOfferteNotification] Email verzonden:",
        {
          to: klant.email,
          offerteNummer: offerte.offerteNummer,
          resendId,
        }
      );

      return { success: true, resendId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Onbekende fout";
      console.error(
        "[portaalEmail/sendOfferteNotification] Failed:",
        errorMessage
      );
      return { success: false, error: errorMessage };
    }
  },
});

// ── 3. Send Message Notification ───────────────────────────────────────

export const sendMessageNotification = internalAction({
  args: {
    klantId: v.id("klanten"),
    berichtVoorbeeld: v.optional(v.string()),
    afzenderNaam: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; resendId?: string; error?: string }> => {
    // Look up klant
    const klant = await ctx.runQuery(internal.klanten.getByIdInternal, {
      klantId: args.klantId,
    });
    if (!klant) {
      return { success: false, error: "klant_not_found" };
    }

    if (!klant.portalEnabled) {
      return { success: false, error: "portal_not_enabled" };
    }

    if (!klant.email) {
      return { success: false, error: "no_email" };
    }

    // Get company details
    const bedrijf = await getBedrijfsgegevens(ctx, klant.userId);

    // Build portal URL
    const portaalUrl = `${getPortalUrl()}/portaal/berichten`;

    // Build message preview HTML
    const previewHtml = args.berichtVoorbeeld
      ? `<div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:16px 20px;margin:16px 0 24px;">
          <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 8px;">Bericht</p>
          <p style="color:#374151;font-size:15px;line-height:24px;margin:0;font-style:italic;">${args.berichtVoorbeeld.substring(0, 200)}${args.berichtVoorbeeld.length > 200 ? "..." : ""}</p>
        </div>`
      : "";

    const afzenderStr = args.afzenderNaam
      ? ` van ${args.afzenderNaam}`
      : "";

    const html = wrapInBrandedLayout({
      bedrijfsNaam: bedrijf.naam,
      bedrijfsEmail: bedrijf.email,
      bedrijfsTelefoon: bedrijf.telefoon,
      title: "Nieuw bericht",
      body: `
        <p style="color:#374151;font-size:16px;line-height:24px;margin:0 0 16px;">Beste ${klant.naam},</p>
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          U heeft een nieuw bericht ontvangen${afzenderStr} via het klantenportaal van ${bedrijf.naam}.
        </p>
        ${previewHtml}
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          Log in op uw portaal om het volledige bericht te lezen en te reageren.
        </p>
      `,
      ctaUrl: portaalUrl,
      ctaLabel: "Bericht bekijken",
    });

    try {
      const resendId = await sendViaResend({
        to: klant.email,
        subject: `Nieuw bericht van ${bedrijf.naam}`,
        html,
        fromName: bedrijf.naam,
        replyTo: bedrijf.email,
      });

      console.info(
        "[portaalEmail/sendMessageNotification] Email verzonden:",
        {
          to: klant.email,
          klantNaam: klant.naam,
          resendId,
        }
      );

      return { success: true, resendId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Onbekende fout";
      console.error(
        "[portaalEmail/sendMessageNotification] Failed:",
        errorMessage
      );
      return { success: false, error: errorMessage };
    }
  },
});

// ── 4. Send Factuur Notification ───────────────────────────────────────

export const sendFactuurNotification = internalAction({
  args: {
    factuurId: v.id("facturen"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; resendId?: string; error?: string }> => {
    // Look up factuur
    const factuur = await ctx.runQuery(internal.facturen.getByIdInternal, {
      factuurId: args.factuurId,
    });
    if (!factuur) {
      console.error(
        `[portaalEmail/sendFactuurNotification] Factuur not found: ${args.factuurId}`
      );
      return { success: false, error: "factuur_not_found" };
    }

    // Look up klant via project or offerte
    const klantId = factuur.klantId;
    if (!klantId) {
      return { success: false, error: "no_klant_linked" };
    }

    const klant = await ctx.runQuery(internal.klanten.getByIdInternal, {
      klantId,
    });
    if (!klant) {
      return { success: false, error: "klant_not_found" };
    }

    if (!klant.portalEnabled) {
      return { success: false, error: "portal_not_enabled" };
    }

    if (!klant.email) {
      return { success: false, error: "no_email" };
    }

    // Get company details
    const bedrijf = await getBedrijfsgegevens(ctx, klant.userId);

    // Build portal URL
    const portaalUrl = `${getPortalUrl()}/portaal/facturen`;

    // Format amounts
    const bedragStr = new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    }).format(factuur.totaalInclBtw ?? 0);

    const factuurDatumStr = factuur.factuurdatum
      ? new Date(factuur.factuurdatum).toLocaleDateString("nl-NL")
      : "";
    const vervaldatumStr = factuur.vervaldatum
      ? new Date(factuur.vervaldatum).toLocaleDateString("nl-NL")
      : "";

    const html = wrapInBrandedLayout({
      bedrijfsNaam: bedrijf.naam,
      bedrijfsEmail: bedrijf.email,
      bedrijfsTelefoon: bedrijf.telefoon,
      title: "Nieuwe factuur",
      body: `
        <p style="color:#374151;font-size:16px;line-height:24px;margin:0 0 16px;">Beste ${klant.naam},</p>
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          Er is een nieuwe factuur voor u aangemaakt. U kunt deze inzien en downloaden via uw persoonlijke portaal.
        </p>
        <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 4px;">Factuurnummer</p>
          <p style="color:#1f2937;font-size:16px;font-weight:600;margin:0;">${factuur.factuurnummer ?? ""}</p>
          ${factuurDatumStr ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;" />
          <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 4px;">Factuurdatum</p>
          <p style="color:#1f2937;font-size:16px;font-weight:600;margin:0;">${factuurDatumStr}</p>` : ""}
          ${vervaldatumStr ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;" />
          <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 4px;">Vervaldatum</p>
          <p style="color:#1f2937;font-size:16px;font-weight:600;margin:0;">${vervaldatumStr}</p>` : ""}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;" />
          <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 4px;">Totaal incl. BTW</p>
          <p style="color:#16a34a;font-size:20px;font-weight:700;margin:0;">${bedragStr}</p>
        </div>
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          Heeft u vragen over deze factuur? U kunt via het portaal direct een bericht sturen of contact opnemen met ons kantoor.
        </p>
      `,
      ctaUrl: portaalUrl,
      ctaLabel: "Factuur bekijken",
    });

    try {
      const resendId = await sendViaResend({
        to: klant.email,
        subject: `Nieuwe factuur ${factuur.factuurnummer ?? ""} van ${bedrijf.naam}`,
        html,
        fromName: bedrijf.naam,
        replyTo: bedrijf.email,
      });

      console.info(
        "[portaalEmail/sendFactuurNotification] Email verzonden:",
        {
          to: klant.email,
          factuurnummer: factuur.factuurnummer,
          resendId,
        }
      );

      return { success: true, resendId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Onbekende fout";
      console.error(
        "[portaalEmail/sendFactuurNotification] Failed:",
        errorMessage
      );
      return { success: false, error: errorMessage };
    }
  },
});

// ── 5. Send Project Update Notification ────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  gepland: "Gepland",
  in_voorbereiding: "In voorbereiding",
  actief: "In uitvoering",
  in_uitvoering: "In uitvoering",
  paused: "Gepauzeerd",
  opgeleverd: "Opgeleverd",
  afgerond: "Afgerond",
  geannuleerd: "Geannuleerd",
};

export const sendProjectNotification = internalAction({
  args: {
    projectId: v.id("projecten"),
    newStatus: v.string(),
    toelichting: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; resendId?: string; error?: string }> => {
    // Look up project
    const project = await ctx.runQuery(internal.projecten.getByIdInternal, {
      projectId: args.projectId,
    });
    if (!project) {
      console.error(
        `[portaalEmail/sendProjectNotification] Project not found: ${args.projectId}`
      );
      return { success: false, error: "project_not_found" };
    }

    // Look up klant
    const klantId = project.klantId;
    if (!klantId) {
      return { success: false, error: "no_klant_linked" };
    }

    const klant = await ctx.runQuery(internal.klanten.getByIdInternal, {
      klantId,
    });
    if (!klant) {
      return { success: false, error: "klant_not_found" };
    }

    if (!klant.portalEnabled) {
      return { success: false, error: "portal_not_enabled" };
    }

    if (!klant.email) {
      return { success: false, error: "no_email" };
    }

    // Get company details
    const bedrijf = await getBedrijfsgegevens(ctx, klant.userId);

    // Build portal URL
    const portaalUrl = `${getPortalUrl()}/portaal/projecten`;

    const statusLabel = STATUS_LABELS[args.newStatus] || args.newStatus;
    const projectNaam = project.naam || "Uw project";

    const toelichtingHtml = args.toelichting
      ? `<hr style="border:none;border-top:1px solid #bbf7d0;margin:12px 0;" />
         <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 4px;">Toelichting</p>
         <p style="color:#374151;font-size:14px;line-height:22px;margin:0;font-style:italic;">${args.toelichting}</p>`
      : "";

    const html = wrapInBrandedLayout({
      bedrijfsNaam: bedrijf.naam,
      bedrijfsEmail: bedrijf.email,
      bedrijfsTelefoon: bedrijf.telefoon,
      title: "Update over uw project",
      body: `
        <p style="color:#374151;font-size:16px;line-height:24px;margin:0 0 16px;">Beste ${klant.naam},</p>
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          Wij willen u graag informeren over een update van uw project bij ${bedrijf.naam}.
        </p>
        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:24px 0;">
          <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 4px;">Project</p>
          <p style="color:#1f2937;font-size:18px;font-weight:600;margin:0;">${projectNaam}</p>
          <hr style="border:none;border-top:1px solid #bbf7d0;margin:12px 0;" />
          <p style="color:#6b7280;font-size:12px;font-weight:500;text-transform:uppercase;margin:0 0 4px;">Nieuwe status</p>
          <span style="background-color:#16a34a;border-radius:12px;color:#ffffff;display:inline-block;font-size:13px;font-weight:600;padding:4px 12px;">${statusLabel}</span>
          ${toelichtingHtml}
        </div>
        <p style="color:#4b5563;font-size:15px;line-height:24px;margin:0 0 16px;">
          Bekijk de volledige details en voortgang van uw project via uw persoonlijke portaal.
        </p>
      `,
      ctaUrl: portaalUrl,
      ctaLabel: "Project bekijken",
    });

    try {
      const resendId = await sendViaResend({
        to: klant.email,
        subject: `Update: project "${projectNaam}" — ${statusLabel}`,
        html,
        fromName: bedrijf.naam,
        replyTo: bedrijf.email,
      });

      console.info(
        "[portaalEmail/sendProjectNotification] Email verzonden:",
        {
          to: klant.email,
          projectNaam,
          newStatus: args.newStatus,
          resendId,
        }
      );

      return { success: true, resendId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Onbekende fout";
      console.error(
        "[portaalEmail/sendProjectNotification] Failed:",
        errorMessage
      );
      return { success: false, error: errorMessage };
    }
  },
});
