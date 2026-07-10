/**
 * Uitgaande-mail-wachtrij "Concept-mails" (PRD §2.7).
 *
 * Door mail-triggers klaargezette mails. Kantoor kan:
 * - bewerken (ALLEEN inhoudsvelden — opmaak/huisstijl zit in de layout,
 *   principe 3),
 * - goedkeuren + versturen (assertKanNaarKlantVersturen, §1.2),
 * - verwerpen.
 *
 * VERZENDEN gebeurt uitsluitend in verstuurConceptMail (internalAction) en
 * loopt ALTIJD door de mail-guard isEmailVerzendenActief (fail-closed):
 * zonder EMAIL_VERZENDEN_ACTIEF="true" wordt de poging gelogd met status
 * "onderdrukt (sandbox)" en gaat er niets naar Resend.
 *
 * De dagelijkse cron (verwerkGeplandeMails) zet vertraagde mails alleen
 * KLAAR in de wachtrij; in concept-modus verstuurt de cron nooit zelf iets.
 */

import { v, ConvexError } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import {
  assertKanNaarKlantVersturen,
  getCompanyUserId,
  requireKantoor,
} from "./roles";
import { logTijdlijnEvent } from "./tijdlijn";
import { voegSysteemCommentToe } from "./servicemeldingen";
import { zetTriggerMailKlaar } from "./mailTriggers";
import {
  tekstNaarHtmlParagrafen,
  wrapInBrandedLayout,
} from "./lib/mailRender";
import {
  isEmailVerzendenActief,
  SANDBOX_EMAIL_REDEN,
  SANDBOX_EMAIL_STATUS,
} from "./lib/mailGuard";

// ─── Pure helpers (unit-testbaar zonder ctx) ─────────────────────────────────

/** ISO-datum (YYYY-MM-DD) → Nederlandse weergave, bv. "15 maart 2026". */
export function formatDatumNl(iso: string): string {
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed)) return iso;
  return new Date(parsed).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Periode-tekst voor de inplan-mail: "van {opening} tot {voorziene datum}". */
export function formatVenster(
  vensterOpening: string | undefined,
  voorzieneDatum: string | undefined
): string {
  if (vensterOpening && voorzieneDatum && vensterOpening !== voorzieneDatum) {
    return `van ${formatDatumNl(vensterOpening)} tot ${formatDatumNl(voorzieneDatum)}`;
  }
  const datum = vensterOpening ?? voorzieneDatum;
  return datum ? `vanaf ${formatDatumNl(datum)}` : "die wij voorstellen";
}

/** email_logs-type per trigger-event (opvolging hergebruikt "herinnering"). */
export function emailLogTypeVoorEvent(
  event: string
):
  | "offerte_verzonden"
  | "herinnering"
  | "lead_ontvangen"
  | "inplanning_bevestigd"
  | "inplan_attendering"
  | "trigger_mail" {
  switch (event) {
    case "offerte_verzonden":
      return "offerte_verzonden";
    case "offerte_opvolging":
      return "herinnering";
    case "lead_ontvangen":
      return "lead_ontvangen";
    case "inplanning_bevestigd":
      return "inplanning_bevestigd";
    case "inplan_attendering":
      return "inplan_attendering";
    default:
      return "trigger_mail";
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Wachtrij + vertraagde (geplande) concept-mails voor het beheerscherm.
 * Kantoor-only; scope = bedrijfseigenaar.
 */
export const listWachtrij = query({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const userId = await getCompanyUserId(ctx);

    const alles = await ctx.db
      .query("conceptMails")
      .withIndex("by_user_status", (q) => q.eq("userId", userId))
      .collect();

    return alles
      .filter((m) => m.status === "wachtrij" || m.status === "gepland")
      .sort((a, b) => a.geplandOp - b.geplandOp);
  },
});

/** Recent afgehandelde mails (verzonden/verworpen/mislukt/onderdrukt). */
export const listAfgehandeld = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const userId = await getCompanyUserId(ctx);

    const alles = await ctx.db
      .query("conceptMails")
      .withIndex("by_user_status", (q) => q.eq("userId", userId))
      .collect();

    return alles
      .filter((m) => m.status !== "wachtrij" && m.status !== "gepland")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, args.limit ?? 50);
  },
});

/** Teller voor de navigatie-badge (aantal mails in de wachtrij). */
export const countWachtrij = query({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const userId = await getCompanyUserId(ctx);
    const alles = await ctx.db
      .query("conceptMails")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "wachtrij")
      )
      .collect();
    return alles.length;
  },
});

/** Interne lookup voor de verzend-actie. */
export const getInternal = internalQuery({
  args: { conceptMailId: v.id("conceptMails") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conceptMailId);
  },
});

// ─── Mutations (kantoor) ─────────────────────────────────────────────────────

/**
 * Concept bewerken — ALLEEN inhoudsvelden (onderwerp, inhoud, ontvanger-
 * adres). Opmaak zit in de mail-layout (principe 3). Alleen mogelijk
 * zolang de mail nog niet is afgehandeld.
 */
export const bewerk = mutation({
  args: {
    id: v.id("conceptMails"),
    onderwerp: v.optional(v.string()),
    inhoud: v.optional(v.string()),
    ontvangerEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const concept = await ctx.db.get(args.id);
    if (!concept) throw new ConvexError("Concept-mail niet gevonden");
    if (concept.status !== "wachtrij" && concept.status !== "gepland") {
      throw new ConvexError(
        "Alleen mails in de wachtrij kunnen worden bewerkt"
      );
    }
    if (args.onderwerp !== undefined && args.onderwerp.trim().length === 0) {
      throw new ConvexError("Onderwerp is verplicht");
    }
    if (args.inhoud !== undefined && args.inhoud.trim().length === 0) {
      throw new ConvexError("Inhoud is verplicht");
    }
    if (
      args.ontvangerEmail !== undefined &&
      !args.ontvangerEmail.includes("@")
    ) {
      throw new ConvexError("Ongeldig e-mailadres");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.onderwerp !== undefined) patch.onderwerp = args.onderwerp;
    if (args.inhoud !== undefined) patch.inhoud = args.inhoud;
    if (args.ontvangerEmail !== undefined)
      patch.ontvangerEmail = args.ontvangerEmail;
    await ctx.db.patch(args.id, patch);
    return args.id;
  },
});

/**
 * Goedkeuren + versturen (§1.2): capability *versturen naar klant* vereist
 * (AuthError voor voorman/medewerker/klant). De daadwerkelijke verzending
 * loopt via verstuurConceptMail — en dus door de mail-guard.
 */
export const keurGoedEnVerstuur = mutation({
  args: { id: v.id("conceptMails") },
  handler: async (ctx, args) => {
    const kantoorUser = await assertKanNaarKlantVersturen(ctx);
    const concept = await ctx.db.get(args.id);
    if (!concept) throw new ConvexError("Concept-mail niet gevonden");
    if (concept.status !== "wachtrij" && concept.status !== "gepland") {
      throw new ConvexError(
        "Deze mail is al afgehandeld en kan niet opnieuw worden verstuurd"
      );
    }

    await ctx.db.patch(args.id, {
      status: "wachtrij", // gepland → direct vrijgegeven door kantoor
      behandeldDoorId: kantoorUser._id,
      behandeldAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.conceptMails.verstuurConceptMail, {
      conceptMailId: args.id,
    });

    return args.id;
  },
});

/** Verwerpen: de mail wordt niet verstuurd (kantoor-only). */
export const verwerp = mutation({
  args: { id: v.id("conceptMails") },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const concept = await ctx.db.get(args.id);
    if (!concept) throw new ConvexError("Concept-mail niet gevonden");
    if (concept.status !== "wachtrij" && concept.status !== "gepland") {
      throw new ConvexError("Deze mail is al afgehandeld");
    }

    await ctx.db.patch(args.id, {
      status: "verworpen",
      behandeldDoorId: kantoorUser._id,
      behandeldAt: Date.now(),
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

/**
 * Inplan-mail vanuit een plantaak op het meldingen-bord (§2.1/§2.7):
 * één klik zet de mail als CONCEPT klaar in de wachtrij (forceerConcept —
 * ook als de trigger op "automatisch" zou staan gaat deze persoonlijke
 * mail altijd via goedkeuring). Versturen gebeurt daarna in de wachtrij
 * (of direct via keurGoedEnVerstuur, met dezelfde capability-check).
 */
export const maakInplanConcept = mutation({
  args: { meldingId: v.id("servicemeldingen") },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const melding = await ctx.db.get(args.meldingId);
    if (!melding) throw new ConvexError("Melding niet gevonden");
    if (melding.taaksoort !== "plantaak") {
      throw new ConvexError(
        "Inplan-mails kunnen alleen vanuit een plantaak worden klaargezet"
      );
    }
    if (!melding.klantId) {
      // Plantaken hebben altijd een klant; belt & braces voor het type
      throw new ConvexError("Deze taak heeft geen gekoppelde klant");
    }

    const klant = await ctx.db.get(melding.klantId);
    if (!klant) throw new ConvexError("Klant niet gevonden");
    if (!klant.email) {
      throw new ConvexError(
        "Deze klant heeft geen e-mailadres — vul dat eerst aan op de klantkaart"
      );
    }

    const beurt = melding.werkitemId
      ? await ctx.db.get(melding.werkitemId)
      : null;
    const beurtNaam = beurt?.naam ?? "onderhoudsbeurt";
    const venster = formatVenster(
      melding.deadline,
      beurt?.volgendeVoorzieneDatum
    );

    const resultaat = await zetTriggerMailKlaar(ctx, {
      event: "inplan_attendering",
      userId: melding.userId,
      ontvangerEmail: klant.email,
      ontvangerNaam: klant.naam,
      variabelen: {
        klantnaam: klant.naam,
        beurtnaam: beurtNaam,
        venster,
      },
      klantId: melding.klantId,
      werkitemId: melding.werkitemId ?? undefined,
      meldingId: melding._id,
      dedupeSleutel: `inplan_attendering:${melding._id.toString()}`,
      forceerConcept: true,
    });

    if (!resultaat.aangemaakt) {
      if (resultaat.reden === "duplicaat") {
        throw new ConvexError(
          "Er staat al een inplan-mail voor deze taak in Concept-mails"
        );
      }
      throw new ConvexError(
        "De mail-trigger 'inplan_attendering' is niet actief — zet hem aan bij Instellingen → Mail-triggers"
      );
    }

    await voegSysteemCommentToe(ctx, {
      userId: melding.userId,
      meldingId: melding._id,
      tekst: `Inplan-mail klaargezet in Concept-mails door ${kantoorUser.name ?? "kantoor"} — goedkeuren en versturen via het Concept-mails-scherm.`,
    });

    return { conceptMailId: resultaat.conceptMailId };
  },
});

// ─── Cron — vertraagde mails klaarzetten (verstuurt zelf NIETS) ──────────────

/**
 * Dagelijkse run: geplande (vertraagde) concept-mails waarvan geplandOp is
 * bereikt gaan naar de wachtrij. In concept-modus stopt het daar — kantoor
 * keurt goed. Alleen in automatisch-modus wordt de verzend-actie ingepland,
 * en die actie zit achter de mail-guard (fail-closed).
 */
export const verwerkGeplandeMails = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rijp = await ctx.db
      .query("conceptMails")
      .withIndex("by_status_gepland", (q) =>
        q.eq("status", "gepland").lte("geplandOp", now)
      )
      .collect();

    let naarWachtrij = 0;
    let automatischIngepland = 0;
    for (const concept of rijp) {
      await ctx.db.patch(concept._id, {
        status: "wachtrij",
        updatedAt: now,
      });
      naarWachtrij++;

      if (concept.modus === "automatisch") {
        await ctx.scheduler.runAfter(
          0,
          internal.conceptMails.verstuurConceptMail,
          { conceptMailId: concept._id }
        );
        automatischIngepland++;
      }
    }

    console.log(
      `[conceptMails] cron: ${naarWachtrij} naar wachtrij, ${automatischIngepland} automatisch ingepland (achter mail-guard)`
    );
    return { naarWachtrij, automatischIngepland };
  },
});

// ─── Verzend-resultaat registreren (intern) ──────────────────────────────────

/**
 * Claim vóór verzending (dubbelklik-/race-bescherming): alleen een mail in
 * status "wachtrij" zonder recente claim wordt teruggegeven.
 */
export const claimVoorVerzending = internalMutation({
  args: { conceptMailId: v.id("conceptMails") },
  handler: async (ctx, args): Promise<Doc<"conceptMails"> | null> => {
    const concept = await ctx.db.get(args.conceptMailId);
    if (!concept) return null;
    if (concept.status !== "wachtrij") return null;
    const now = Date.now();
    if (
      concept.verzendingGestartAt &&
      now - concept.verzendingGestartAt < 5 * 60 * 1000
    ) {
      return null; // al onderweg
    }
    await ctx.db.patch(args.conceptMailId, {
      verzendingGestartAt: now,
      updatedAt: now,
    });
    return { ...concept, verzendingGestartAt: now };
  },
});

/**
 * Resultaat van een verzendpoging vastleggen: conceptMail-status,
 * email_logs-regel (bestaand patroon, óók bij onderdrukking) en
 * klanttijdlijn-event (kanaal "email"). Geen PII in console-logs.
 */
export const registreerVerzendResultaat = internalMutation({
  args: {
    conceptMailId: v.id("conceptMails"),
    status: v.union(
      v.literal("verzonden"),
      v.literal("mislukt"),
      v.literal("onderdrukt (sandbox)")
    ),
    resendId: v.optional(v.string()),
    foutmelding: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const concept = await ctx.db.get(args.conceptMailId);
    if (!concept) return;

    const now = Date.now();
    await ctx.db.patch(args.conceptMailId, {
      status: args.status,
      resendId: args.resendId,
      foutmelding: args.foutmelding,
      verzondenAt: args.status === "verzonden" ? now : undefined,
      updatedAt: now,
    });

    // email_logs — bestaand logging-patroon, ook voor onderdrukte mails
    await ctx.db.insert("email_logs", {
      offerteId: concept.offerteId,
      userId: concept.userId,
      type: emailLogTypeVoorEvent(concept.event),
      to: concept.ontvangerEmail,
      subject: concept.onderwerp,
      status: args.status,
      resendId: args.resendId,
      error: args.foutmelding,
      createdAt: now,
    });

    // Klanttijdlijn (§2.3/§2.7): kanaal "email"; onderdrukte (sandbox)
    // mails loggen mét die status. Niet-blokkerend.
    if (concept.klantId) {
      const statusTekst =
        args.status === "verzonden"
          ? "verzonden"
          : args.status === "mislukt"
            ? "mislukt"
            : "onderdrukt (sandbox)";
      await logTijdlijnEvent(ctx, {
        userId: concept.userId,
        klantId: concept.klantId,
        eventType: "mail_verzonden",
        kanaal: "email",
        tekst: `Mail "${concept.onderwerp}" aan ${concept.ontvangerEmail} — ${statusTekst}`,
        werkitemId: concept.werkitemId,
        meldingId: concept.meldingId,
      });
    }
  },
});

// ─── DE verzend-actie (enige externe pad, achter de mail-guard) ──────────────

/**
 * Verstuur een concept-mail via Resend. Dit is voor het hele §2.7-systeem
 * het ENIGE pad naar extern versturen en het staat volledig achter de
 * mail-guard: zonder EMAIL_VERZENDEN_ACTIEF="true" (fail-closed) wordt de
 * poging alleen gelogd (status "onderdrukt (sandbox)") en verlaat er niets
 * het systeem.
 *
 * Bereikbaar via precies twee routes:
 * 1. kantoor keurt goed (keurGoedEnVerstuur, assertKanNaarKlantVersturen);
 * 2. modus "automatisch" (zetTriggerMailKlaar / verwerkGeplandeMails).
 */
export const verstuurConceptMail = internalAction({
  args: { conceptMailId: v.id("conceptMails") },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    // Claim (dubbelklik-/race-bescherming) — alleen wachtrij-mails
    const concept: Doc<"conceptMails"> | null = await ctx.runMutation(
      internal.conceptMails.claimVoorVerzending,
      { conceptMailId: args.conceptMailId }
    );
    if (!concept) {
      return { success: false, error: "niet_claimbaar" };
    }

    // MAIL-GUARD (fail-closed) — ALTIJD eerst, vóór elke externe stap
    if (!isEmailVerzendenActief()) {
      console.warn(
        `[conceptMails/verstuur] ${SANDBOX_EMAIL_STATUS}: "${concept.onderwerp}" (event ${concept.event}) niet verstuurd — ${SANDBOX_EMAIL_REDEN}`
      );
      await ctx.runMutation(internal.conceptMails.registreerVerzendResultaat, {
        conceptMailId: args.conceptMailId,
        status: SANDBOX_EMAIL_STATUS,
        foutmelding: SANDBOX_EMAIL_REDEN,
      });
      return { success: false, error: "email_sandbox" };
    }

    // Bedrijfsgegevens voor de huisstijl-layout
    const instellingen = (await ctx.runQuery(
      internal.instellingen.getByUserId,
      { userId: concept.userId }
    )) as Record<string, unknown> | null;
    const bedrijfsgegevens = (instellingen?.bedrijfsgegevens ?? {}) as Record<
      string,
      string
    >;
    const bedrijfsNaam = bedrijfsgegevens.naam || "Top Tuinen";
    const bedrijfsEmail = bedrijfsgegevens.email || "";
    const bedrijfsTelefoon = bedrijfsgegevens.telefoon || "";

    const html = wrapInBrandedLayout({
      bedrijfsNaam,
      bedrijfsEmail,
      bedrijfsTelefoon,
      title: concept.onderwerp,
      bodyHtml: tekstNaarHtmlParagrafen(concept.inhoud),
    });

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("[conceptMails/verstuur] RESEND_API_KEY niet geconfigureerd");
      await ctx.runMutation(internal.conceptMails.registreerVerzendResultaat, {
        conceptMailId: args.conceptMailId,
        status: "mislukt",
        foutmelding: "RESEND_API_KEY niet geconfigureerd",
      });
      return { success: false, error: "resend_not_configured" };
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@toptuinen.nl";

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${bedrijfsNaam} <${fromEmail}>`,
          to: [concept.ontvangerEmail],
          subject: concept.onderwerp,
          html,
          reply_to: bedrijfsEmail || undefined,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[conceptMails/verstuur] Resend API fout (${response.status}) voor event ${concept.event}`
        );
        await ctx.runMutation(
          internal.conceptMails.registreerVerzendResultaat,
          {
            conceptMailId: args.conceptMailId,
            status: "mislukt",
            foutmelding: `Resend API fout (${response.status}): ${errorText.substring(0, 200)}`,
          }
        );
        return { success: false, error: `resend_${response.status}` };
      }

      const result = await response.json();
      const resendId = result.id as string | undefined;

      console.info(
        `[conceptMails/verstuur] verzonden: event=${concept.event}, resendId=${resendId}`
      );
      await ctx.runMutation(internal.conceptMails.registreerVerzendResultaat, {
        conceptMailId: args.conceptMailId,
        status: "verzonden",
        resendId,
      });
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Onbekende fout";
      console.error(
        `[conceptMails/verstuur] verzending mislukt (event=${concept.event}):`,
        error instanceof Error ? error.name : "onbekende fout"
      );
      await ctx.runMutation(internal.conceptMails.registreerVerzendResultaat, {
        conceptMailId: args.conceptMailId,
        status: "mislukt",
        foutmelding: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  },
});
