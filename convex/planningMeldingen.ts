/**
 * Meldingen naar de medewerker-app bij een planwijziging (HERO-nabouw fase 4,
 * PLANNING-MODULE.md "Koppeling met de medewerker-app").
 *
 * - Alleen als de wijziging vandaag of morgen raakt (oud of nieuw).
 * - Gebundeld: updatePlanning plant de melding 2 minuten vooruit; is het
 *   werkitem in die tijd opnieuw gewijzigd, dan slaat deze over en stuurt de
 *   latere. Zo geeft vijf keer slepen één melding.
 * - Ontvangers: de bemanning van het oude én het nieuwe team op die dagen.
 * - In-app melding altijd; push alleen met een geregistreerd toestel, en
 *   achter de mail/push-guard (EMAIL_VERZENDEN_ACTIEF).
 */

import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { addDagen, bemanningVoorDag } from "./planbordLogica";
import { vandaagAmsterdam } from "./lib/taakModel";

export const BUNDEL_MS = 2 * 60 * 1000;

/** Dagen (vandaag/morgen) die een plan raakt. */
export function geraakteDagen(
  plannen: ReadonlyArray<{ start?: string; eind?: string }>,
  vandaag: string
): string[] {
  const morgen = addDagen(vandaag, 1);
  return [vandaag, morgen].filter((d) =>
    plannen.some((p) => p.start && d >= p.start && d <= (p.eind ?? p.start))
  );
}

async function bemanningOp(
  ctx: MutationCtx,
  teamId: Id<"teams"> | undefined,
  datum: string
): Promise<Id<"medewerkers">[]> {
  if (!teamId) return [];
  const team = await ctx.db.get(teamId);
  if (!team) return [];
  const rij = await ctx.db
    .query("teamBemanning")
    .withIndex("by_team_datum", (q) => q.eq("teamId", teamId).eq("datum", datum))
    .unique();
  return bemanningVoorDag(team, rij).medewerkerIds;
}

/**
 * Plan een (gebundelde) melding. Aanroepen ná de patch in updatePlanning,
 * met de stand van vóór de wijziging.
 */
export async function planMeldingNaWijziging(
  ctx: MutationCtx,
  voor: Pick<Doc<"projecten">, "_id" | "teamId" | "geplandeStart" | "geplandeEind">,
  na: { geplandeStart?: string; geplandeEind?: string },
  updatedAt: number
): Promise<void> {
  // Raakt de wijziging vandaag of morgen niet, dan geen melding
  const dagen = geraakteDagen(
    [
      { start: voor.geplandeStart, eind: voor.geplandeEind },
      { start: na.geplandeStart, eind: na.geplandeEind },
    ],
    vandaagAmsterdam()
  );
  if (dagen.length === 0) return;
  await ctx.scheduler.runAfter(BUNDEL_MS, internal.planningMeldingen.verstuur, {
    werkitemId: voor._id,
    wijzigingOp: updatedAt,
    oudTeamId: voor.teamId,
    oudStart: voor.geplandeStart,
    oudEind: voor.geplandeEind,
  });
}

export const verstuur = internalMutation({
  args: {
    werkitemId: v.id("projecten"),
    wijzigingOp: v.number(),
    oudTeamId: v.optional(v.id("teams")),
    oudStart: v.optional(v.string()),
    oudEind: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const w = await ctx.db.get(args.werkitemId);
    // Later nog gewijzigd: die latere melding gaat de deur uit
    if (!w || (w.updatedAt ?? 0) > args.wijzigingOp || !w.orgId) return;

    const vandaag = vandaagAmsterdam();
    const dagen = geraakteDagen(
      [
        { start: args.oudStart, eind: args.oudEind },
        { start: w.geplandeStart, eind: w.geplandeEind },
      ],
      vandaag
    );
    if (dagen.length === 0) return;

    const ontvangers = new Set<string>();
    for (const d of dagen) {
      for (const team of [args.oudTeamId, w.teamId]) {
        for (const m of await bemanningOp(ctx, team, d)) ontvangers.add(m);
      }
    }
    if (ontvangers.size === 0) return;

    const wanneer = dagen.includes(vandaag) ? "vandaag" : "morgen";
    const tijd =
      w.geplandeStart && w.geplandeStartTijd
        ? ` (${w.geplandeStartTijd}–${w.geplandeEindTijd ?? ""})`
        : "";
    const tekst = w.geplandeStart
      ? `${w.naam} is gewijzigd voor ${wanneer}${tijd}. Kijk in je planning.`
      : `${w.naam} staat ${wanneer} niet meer op je planning.`;

    const push: { to: string; title: string; body: string; data: Record<string, string> }[] = [];
    for (const id of ontvangers) {
      const m = await ctx.db.get(id as Id<"medewerkers">);
      if (!m?.clerkUserId) continue;
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", m.clerkUserId!))
        .unique();
      if (!user) continue;
      await ctx.scheduler.runAfter(0, internal.notifications.createInAppNotification, {
        userId: user._id,
        orgId: w.orgId,
        type: "project_status_update",
        title: "Planning gewijzigd",
        message: tekst,
        projectId: w._id,
        projectNaam: w.naam,
      });
      const voorkeur = await ctx.db
        .query("notification_preferences")
        .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", m.clerkUserId!))
        .unique();
      if (voorkeur?.enablePushNotifications && voorkeur.deviceToken) {
        push.push({
          to: voorkeur.deviceToken,
          title: "Planning gewijzigd",
          body: tekst,
          data: { type: "planning", werkitemId: w._id },
        });
      }
    }
    if (push.length > 0) {
      await ctx.scheduler.runAfter(0, internal.notifications.sendExpoPushNotification, {
        messages: push,
      });
    }
  },
});

/**
 * Losse melding aan één medewerker (bv. besluit over een verlofaanvraag).
 * In-app altijd; push als er een toestel geregistreerd is (achter de guard).
 */
export async function meldMedewerker(
  ctx: MutationCtx,
  medewerkerId: Id<"medewerkers">,
  orgId: Id<"organisaties">,
  titel: string,
  tekst: string
): Promise<void> {
  const m = await ctx.db.get(medewerkerId);
  if (!m?.clerkUserId) return;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", m.clerkUserId!))
    .unique();
  if (!user) return;
  await ctx.scheduler.runAfter(0, internal.notifications.createInAppNotification, {
    userId: user._id,
    orgId,
    type: "system_announcement",
    title: titel,
    message: tekst,
  });
  const voorkeur = await ctx.db
    .query("notification_preferences")
    .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", m.clerkUserId!))
    .unique();
  if (voorkeur?.enablePushNotifications && voorkeur.deviceToken) {
    await ctx.scheduler.runAfter(0, internal.notifications.sendExpoPushNotification, {
      messages: [{ to: voorkeur.deviceToken, title: titel, body: tekst }],
    });
  }
}
