/**
 * Uurtarief als instelling met ingangsdatum (PRD §2.5a/f, acceptatietest §8.7)
 *
 * Het uurtarief is geen hardcoded getal maar een historie van tarief-records.
 * Het geldende tarief op een datum = het record met de meest recente
 * ingangsdatum ≤ die datum. Zo behouden historische offertes en contracten
 * het tarief dat gold op hun eigen datum: een tariefwijziging heeft géén
 * effect op documenten met een eerdere datum.
 *
 * Startwaarde: €65 ex btw (gezet door de seed, migrations/seedBouwstenen.ts).
 * NB: het bestaande veld `instellingen.uurtarief` (per-user, zonder historie)
 * blijft ongemoeid voor de aanleg-calculatie-engine; deze tabel is de bron
 * voor de onderhoud-catalogus en latere offerte-/contractintegratie (§2.5a).
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { requireKantoor } from "./roles";

/** Startwaarde uurtarief ex btw (PRD §2.5a, besluit Romeo 8 juli 2026). */
export const STANDAARD_UURTARIEF = 65;

// ─── Pure helpers (unit-testbaar zonder ctx) ─────────────────────────────────

const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

/** Valideer een ingangsdatum als "YYYY-MM-DD". Gooit ConvexError. */
export function valideerIngangsdatum(datum: string): void {
  if (!DATUM_PATROON.test(datum)) {
    throw new ConvexError("Ingangsdatum moet het formaat JJJJ-MM-DD hebben");
  }
  const parsed = new Date(`${datum}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== datum
  ) {
    throw new ConvexError("Ingangsdatum is geen geldige datum");
  }
}

export interface TariefRecord {
  bedrag: number;
  ingangsdatum: string; // "YYYY-MM-DD"
}

/**
 * Bepaal het geldende tarief op een datum: het record met de meest recente
 * ingangsdatum ≤ datum. "YYYY-MM-DD" vergelijkt lexicografisch correct.
 * Null als er op die datum nog geen tarief gold.
 */
export function bepaalTariefOpDatum<T extends TariefRecord>(
  tarieven: T[],
  datum: string
): T | null {
  let geldend: T | null = null;
  for (const tarief of tarieven) {
    if (tarief.ingangsdatum > datum) continue;
    if (geldend === null || tarief.ingangsdatum > geldend.ingangsdatum) {
      geldend = tarief;
    }
  }
  return geldend;
}

/** Vandaag als "YYYY-MM-DD" (lokale tijd Europe/Amsterdam is hier niet
 * kritisch: tarieven gaan per kalenderdag in; UTC volstaat voor de grens). */
export function vandaagIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Geldend uurtarief op een datum (voor offertes/contracten: historische
 * documenten behouden hun eigen tarief). Alle staff-rollen mogen lezen;
 * beheren is kantoor-only.
 */
export const getUurtariefOpDatum = query({
  args: { datum: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    valideerIngangsdatum(args.datum);
    const tarieven = await ctx.db.query("uurtarieven").collect();
    return bepaalTariefOpDatum(tarieven, args.datum);
  },
});

/** Huidig geldend uurtarief (ingangsdatum ≤ vandaag). */
export const getHuidig = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    const tarieven = await ctx.db.query("uurtarieven").collect();
    return bepaalTariefOpDatum(tarieven, vandaagIso());
  },
});

/** Volledige tariefhistorie, nieuwste eerst (beheerscherm, kantoor-only). */
export const listHistorie = query({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const tarieven = await ctx.db.query("uurtarieven").collect();
    return tarieven.sort((a, b) =>
      b.ingangsdatum.localeCompare(a.ingangsdatum)
    );
  },
});

// ─── Mutations (kantoor-only) ────────────────────────────────────────────────

/**
 * Nieuw tarief per ingangsdatum. Idempotent per datum: bestaat er al een
 * record met dezelfde ingangsdatum, dan wordt dat bijgewerkt (één tarief
 * per ingangsdatum). Historie wordt nooit verwijderd.
 */
export const nieuwTarief = mutation({
  args: {
    bedrag: v.number(),
    ingangsdatum: v.string(),
    opmerking: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);

    if (!Number.isFinite(args.bedrag) || args.bedrag <= 0) {
      throw new ConvexError("Uurtarief moet groter dan 0 zijn");
    }
    valideerIngangsdatum(args.ingangsdatum);

    const bestaand = await ctx.db
      .query("uurtarieven")
      .withIndex("by_ingangsdatum", (q) =>
        q.eq("ingangsdatum", args.ingangsdatum)
      )
      .unique();

    if (bestaand) {
      await ctx.db.patch(bestaand._id, {
        bedrag: args.bedrag,
        opmerking: args.opmerking,
        aangemaaktDoor: user._id,
      });
      return bestaand._id;
    }

    return await ctx.db.insert("uurtarieven", {
      bedrag: args.bedrag,
      ingangsdatum: args.ingangsdatum,
      opmerking: args.opmerking,
      aangemaaktDoor: user._id,
      createdAt: Date.now(),
    });
  },
});
