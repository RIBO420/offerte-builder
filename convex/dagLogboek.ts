/**
 * Daglogboek — "Wat heb ik gedaan?" onder de zwevende knop op het werkbord.
 *
 * ── Waarom dit NIET in urenSegmenten zit ─────────────────────────────────────
 * `urenSegmenten` is de gecontroleerde urenketen: registratie, goedkeuring,
 * correcties, rapportage en uiteindelijk de nacalculatie. Daar horen losse
 * krabbels van tussendoor niet in — één verkeerd geparseerd "45m" zou dan een
 * urenstaat vervuilen die kantoor moet goedkeuren. Het logboek is een
 * persoonlijk geheugensteuntje met een optioneel urengetal; wie uren echt
 * indient gaat via /uren (de knop in de voettekst van het paneel).
 *
 * Alleen je EIGEN regels van VANDAAG zijn zichtbaar; het is geen teamlogboek.
 * Klantaccounts hebben er niets te zoeken.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { AuthError, requireAuth, requireOrgId } from "./auth";
import { normalizeRole } from "./roles";
import { vandaagAmsterdam } from "./lib/taakModel";

const MAX_TEKST = 500;

/** Uren uit "1,5u" / "2 uur" / "45m". */
const UREN_PATROON = /(\d+[.,]?\d*)\s*(u|uur|h)\b/i;
const MINUTEN_PATROON = /(\d+)\s*(m|min|minuten)\b/i;

/**
 * Tijdsaanduiding uit een logregel halen.
 *
 * Uren winnen van minuten ("1,5u" is duidelijker dan een losse "30m" verderop
 * in dezelfde zin). Minuten worden op 0,1 uur afgerond, want dat is de
 * precisie waarin de rest van de urenmodule rekent: "45m" → 0,8. Zonder
 * tijdsaanduiding blijft het gewoon een logregel zónder uren — dat is een
 * geldige uitkomst, geen fout.
 */
export function parseerUren(tekst: string): number | undefined {
  const urenMatch = tekst.match(UREN_PATROON);
  if (urenMatch) {
    const waarde = Number(urenMatch[1].replace(",", "."));
    if (Number.isFinite(waarde) && waarde > 0) {
      return Math.round(waarde * 10) / 10;
    }
  }

  const minutenMatch = tekst.match(MINUTEN_PATROON);
  if (minutenMatch) {
    const minuten = Number(minutenMatch[1]);
    if (Number.isFinite(minuten) && minuten > 0) {
      return Math.round((minuten / 60) * 10) / 10;
    }
  }

  return undefined;
}

async function requireInterneRol(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (normalizeRole(user.role) === "klant") {
    throw new AuthError(
      "Het daglogboek is intern en niet beschikbaar voor klantaccounts"
    );
  }
  return user;
}

export const vandaag = query({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    datum: string;
    regels: Array<{
      _id: Id<"dagLogboek">;
      tekst: string;
      uren?: number;
      timestamp: number;
    }>;
    totaalUren: number;
  }> => {
    const user = await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);
    const datum = vandaagAmsterdam();

    const regels = await ctx.db
      .query("dagLogboek")
      .withIndex("by_org_user_datum", (q) =>
        q.eq("orgId", orgId).eq("userId", user._id).eq("datum", datum)
      )
      .collect();

    const gesorteerd = regels.sort((a, b) => a.timestamp - b.timestamp);
    const totaalUren = gesorteerd.reduce((som, r) => som + (r.uren ?? 0), 0);

    return {
      datum,
      regels: gesorteerd.map((r) => ({
        _id: r._id,
        tekst: r.tekst,
        uren: r.uren,
        timestamp: r.timestamp,
      })),
      // Optellen van tienden geeft drijvende-kommaruis (0,8 + 0,1 = 0,9000…1);
      // het paneel toont één decimaal, dus ronden we hier al af.
      totaalUren: Math.round(totaalUren * 10) / 10,
    };
  },
});

export const voegToe = mutation({
  args: { tekst: v.string() },
  handler: async (ctx, args): Promise<Id<"dagLogboek">> => {
    const user = await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);

    const tekst = args.tekst.trim();
    if (!tekst) throw new ConvexError("Een logregel kan niet leeg zijn");
    if (tekst.length > MAX_TEKST) {
      throw new ConvexError(`Een logregel mag maximaal ${MAX_TEKST} tekens zijn`);
    }

    const now = Date.now();
    return await ctx.db.insert("dagLogboek", {
      orgId,
      userId: user._id,
      datum: vandaagAmsterdam(now),
      timestamp: now,
      tekst,
      uren: parseerUren(tekst),
    });
  },
});

/** Verkeerd getypte regel weghalen; alleen je eigen regels. */
export const verwijder = mutation({
  args: { regelId: v.id("dagLogboek") },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const user = await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);

    const regel = await ctx.db.get(args.regelId);
    if (
      !regel ||
      regel.orgId?.toString() !== orgId.toString() ||
      regel.userId.toString() !== user._id.toString()
    ) {
      throw new ConvexError("Logregel niet gevonden");
    }

    await ctx.db.delete(args.regelId);
    return { success: true };
  },
});
