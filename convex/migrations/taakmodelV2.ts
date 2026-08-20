/**
 * Eenmalige datamigratie naar taakmodel v2 (fase 1.1 van
 * docs/superpowers/plans/2026-08-20-klantdossier-v13-werkbord.md).
 *
 * Wat v2 verandert aan een bestaande `klantTaken`-rij:
 *   - status `open` → `todo`, `afgerond` → `klaar` (v2 kent er vier: todo,
 *     bezig, check, klaar);
 *   - de medewerkers-toewijzing `toegewezenAanId` wordt de users-rol
 *     `makerId` — v2 wijst aan ácccounts toe, niet aan medewerkersrijen, want
 *     kantoor/directie heeft wél een account maar lang niet altijd een
 *     medewerkersrij (dat was precies de blokkade in v1);
 *   - `aangemaaktDoorId` (al een users-id) wordt `uitgezetDoorId`;
 *   - `laatsteBewegingOp` (de stilstandmeter van het werkbord) krijgt
 *     `_creationTime` als startwaarde;
 *   - `toegewezenAanId` gaat daarna leeg. Het veld zelf blijft nog even in het
 *     schema staan (deprecated) zodat een halve run niets kapotmaakt.
 *
 * Commando's:
 *   npx convex run migrations/taakmodelV2:voorTelling
 *   npx convex run migrations/taakmodelV2:migreer
 *   npx convex run migrations/taakmodelV2:migreer   # herhalen tot klaar=true
 *   npx convex run migrations/taakmodelV2:voorTelling
 *
 * ── Drie keuzes die je moet kennen ──────────────────────────────────────────
 *
 * 1. GEEN zelfplanning. `naarOrganisaties` plant zichzelf opnieuw in via
 *    `internal.…`; dat kan hier niet, omdat dit bestand nieuw is en de
 *    orchestrator de codegen pas ná deze commit draait. In plaats daarvan
 *    verwerkt elke aanroep maximaal `BATCH` rijen en zegt het antwoord of er
 *    nog werk ligt (`klaar`). Voor de omvang van deze tabel is dat één, hooguit
 *    een paar aanroepen.
 *
 * 2. IDEMPOTENT. Een rij die al v2 is (v2-status, `laatsteBewegingOp` gezet,
 *    geen `toegewezenAanId` meer) wordt overgeslagen. Twee keer draaien is dus
 *    een no-op, en een afgebroken run hervat gewoon.
 *
 * 3. GEEN MATCH = LEEG. Hangt de oude toewijzing aan een medewerker zonder
 *    `clerkUserId` (of zonder users-rij), dan blijft `makerId` leeg. Liever een
 *    taak zonder maker dan een taak die op de verkeerde naam staat; het bord
 *    heeft er een kolom "Niet toegewezen" voor.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** Rijen per aanroep van `migreer`. */
export const BATCH = 500;

type TaakStatusV2 = "todo" | "bezig" | "check" | "klaar";

/**
 * Statusvertaling v1 → v2. Losse pure functie zodat de mapping in een test
 * vastligt zonder database (`taakmodel-v2.test.ts`).
 */
export function migreerStatus(status: string): TaakStatusV2 {
  switch (status) {
    case "open":
      return "todo";
    case "afgerond":
      return "klaar";
    case "todo":
    case "bezig":
    case "check":
    case "klaar":
      return status;
    default:
      // Onbekende waarde kan alleen ontstaan door handmatig gerommel in de
      // database; "todo" is de veilige landing (zichtbaar, niet afgevinkt).
      return "todo";
  }
}

/** Heeft deze rij nog werk nodig? */
export function heeftMigratieNodig(taak: {
  status: string;
  laatsteBewegingOp?: number;
  toegewezenAanId?: unknown;
  aangemaaktDoorId?: unknown;
  uitgezetDoorId?: unknown;
}): boolean {
  if (taak.status === "open" || taak.status === "afgerond") return true;
  if (taak.laatsteBewegingOp === undefined) return true;
  if (taak.toegewezenAanId !== undefined) return true;
  if (taak.uitgezetDoorId === undefined && taak.aangemaaktDoorId !== undefined) {
    return true;
  }
  return false;
}

/**
 * medewerkerId → users-id, via `medewerkers.clerkUserId` en de index
 * `users.by_clerk_id`. Resultaten worden gecachet: in de praktijk delen veel
 * taken dezelfde handvol medewerkers.
 */
async function zoekUserVanMedewerker(
  ctx: MutationCtx,
  medewerkerId: Id<"medewerkers">,
  cache: Map<string, Id<"users"> | null>
): Promise<Id<"users"> | null> {
  const sleutel = medewerkerId.toString();
  const bekend = cache.get(sleutel);
  if (bekend !== undefined) return bekend;

  const medewerker = await ctx.db.get(medewerkerId);
  // Convex-regel 4: `clerkUserId` is optioneel, dus nooit ongeguard de
  // index-`q.eq` in — `q.eq("clerkId", undefined)` zou élk account zonder
  // clerkId matchen en de taak aan een willekeurige rij hangen.
  const clerkUserId = medewerker?.clerkUserId;
  if (!clerkUserId) {
    cache.set(sleutel, null);
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkUserId))
    .unique();
  const resultaat = user?._id ?? null;
  cache.set(sleutel, resultaat);
  return resultaat;
}

/** Wat één rij moet worden. Puur, zodat de test hem zonder db kan draaien. */
export function bouwPatch(
  taak: Pick<
    Doc<"klantTaken">,
    "status" | "laatsteBewegingOp" | "aangemaaktDoorId" | "uitgezetDoorId"
  > & { _creationTime: number },
  makerId: Id<"users"> | null
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    status: migreerStatus(taak.status),
    laatsteBewegingOp: taak.laatsteBewegingOp ?? taak._creationTime,
    // Leegmaken hoort bij de migratie: v1 en v2 mogen niet naast elkaar op
    // dezelfde rij staan, anders leest de ene lezer een andere waarheid.
    toegewezenAanId: undefined,
  };
  if (makerId) patch.makerId = makerId;
  if (taak.uitgezetDoorId === undefined && taak.aangemaaktDoorId !== undefined) {
    patch.uitgezetDoorId = taak.aangemaaktDoorId;
  }
  return patch;
}

/**
 * Voortgangsmeter: hoeveel rijen zijn er, en hoeveel wachten er nog?
 * Draai hem vóór en ná `migreer`.
 */
export const voorTelling = internalQuery({
  args: {},
  handler: async (ctx) => {
    const taken = await ctx.db.query("klantTaken").collect();
    const perStatus: Record<string, number> = {};
    let teDoen = 0;
    let metMaker = 0;
    for (const taak of taken) {
      perStatus[taak.status] = (perStatus[taak.status] ?? 0) + 1;
      if (heeftMigratieNodig(taak)) teDoen += 1;
      if (taak.makerId) metMaker += 1;
    }
    return { totaal: taken.length, teDoen, metMaker, perStatus };
  },
});

/**
 * Verwerk maximaal `BATCH` rijen. Herhaal tot `klaar: true`.
 */
export const migreer = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limiet = Math.max(1, Math.min(args.limit ?? BATCH, BATCH));
    const taken = await ctx.db.query("klantTaken").collect();
    const openstaand = taken.filter(heeftMigratieNodig);

    const cache = new Map<string, Id<"users"> | null>();
    let verwerkt = 0;
    let zonderMaker = 0;

    for (const taak of openstaand.slice(0, limiet)) {
      const makerId = taak.toegewezenAanId
        ? await zoekUserVanMedewerker(ctx, taak.toegewezenAanId, cache)
        : null;
      if (taak.toegewezenAanId && !makerId) zonderMaker += 1;
      await ctx.db.patch(taak._id, bouwPatch(taak, makerId));
      verwerkt += 1;
    }

    return {
      verwerkt,
      zonderMaker,
      resterend: Math.max(0, openstaand.length - verwerkt),
      klaar: openstaand.length <= verwerkt,
    };
  },
});
