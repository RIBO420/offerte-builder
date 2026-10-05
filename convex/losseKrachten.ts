/** Accountloze personen: beperkte voormanroute, zonder login of beheerrechten. */
import { v, ConvexError } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { type Id, type Doc } from "./_generated/dataModel";
import { veldContext, segmentenVoorDag, dagStatusVoor, voegSegmentToe,
  segmentCategorieValidator, werksoortValidator, type VeldContext } from "./urenSegmenten";

function assertBeheerder(veld: VeldContext) {
  if (veld.rol !== "voorman" && veld.rol !== "kantoor") {
    throw new ConvexError("Alleen een voorman of kantoor kan losse krachten registreren.");
  }
}

function assertSleutel(sleutel: string) {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(sleutel)) throw new ConvexError("Ongeldige opdrachtsleutel.");
}

async function accountloos(ctx: QueryCtx | MutationCtx, persoon: Doc<"medewerkers">) {
  if (persoon.clerkUserId || persoon.status === "active") return false;
  // De accountkoppeling kan al bestaan voordat clerkUserId is bijgewerkt.
  const gekoppeld = await ctx.db.query("users").withIndex("by_linked_medewerker", (q) =>
    q.eq("linkedMedewerkerId", persoon._id)).first();
  return !gekoppeld;
}

async function doelKracht(ctx: QueryCtx | MutationCtx, veld: VeldContext, id: Id<"medewerkers">) {
  const persoon = await ctx.db.get(id);
  if (!persoon || persoon.orgId !== veld.orgId || !persoon.losseKracht || !persoon.isActief ||
      (veld.rol !== "kantoor" && persoon.losseKrachtBeheerderId !== veld.user._id)) {
    throw new ConvexError("Losse kracht niet beschikbaar voor deze voorman.");
  }
  if (!await accountloos(ctx, persoon)) {
    throw new ConvexError("Deze medewerker heeft een account. Gebruik de gewone urenflow.");
  }
  return persoon;
}

export const mijnLosseKrachten = query({
  args: {},
  handler: async (ctx) => {
    const veld = await veldContext(ctx);
    assertBeheerder(veld);
    const personen = veld.rol === "kantoor"
      ? await ctx.db.query("medewerkers").withIndex("by_org", (q) => q.eq("orgId", veld.orgId)).collect()
      : await ctx.db.query("medewerkers").withIndex("by_org_losse_beheerder", (q) =>
          q.eq("orgId", veld.orgId).eq("losseKrachtBeheerderId", veld.user._id)).collect();
    const resultaat = [];
    for (const p of personen) {
      if (p.losseKracht && p.isActief && await accountloos(ctx, p)) {
        resultaat.push({ _id: p._id, naam: p.naam, herkomstPlatform: p.herkomstPlatform ?? null });
      }
    }
    return resultaat.sort((a, b) => a.naam.localeCompare(b.naam));
  },
});

export const maakLosseKracht = mutation({
  args: { naam: v.string(), herkomstPlatform: v.optional(v.string()), sleutel: v.string() },
  handler: async (ctx, args) => {
    const veld = await veldContext(ctx);
    assertBeheerder(veld);
    assertSleutel(args.sleutel);
    const naam = args.naam.trim().replace(/\s+/g, " ");
    const herkomstPlatform = args.herkomstPlatform?.trim() || undefined;
    if (!naam || naam.length > 150 || (herkomstPlatform?.length ?? 0) > 150) {
      throw new ConvexError("Vul een naam en herkomst van maximaal 150 tekens in.");
    }
    const eerder = await ctx.db.query("medewerkers").withIndex("by_org_losse_sleutel", (q) =>
      q.eq("orgId", veld.orgId).eq("losseKrachtBeheerderId", veld.user._id).eq("losseKrachtSleutel", args.sleutel)).unique();
    if (eerder) {
      if (eerder.naam !== naam || eerder.herkomstPlatform !== herkomstPlatform) {
        throw new ConvexError("Deze opdrachtsleutel is gebruikt voor een andere persoon.");
      }
      return eerder._id;
    }
    const now = Date.now();
    return await ctx.db.insert("medewerkers", {
      orgId: veld.orgId, naam, herkomstPlatform, isActief: true,
      losseKracht: true, losseKrachtBeheerderId: veld.user._id, losseKrachtSleutel: args.sleutel,
      createdAt: now, updatedAt: now,
    });
  },
});

export const getLosseKrachtDag = query({
  args: { medewerkerId: v.id("medewerkers"), datum: v.string() },
  handler: async (ctx, args) => {
    const veld = await veldContext(ctx);
    assertBeheerder(veld);
    const persoon = await doelKracht(ctx, veld, args.medewerkerId);
    const [segmenten, dag] = await Promise.all([
      segmentenVoorDag(ctx.db, veld.orgId, persoon._id, args.datum),
      dagStatusVoor(ctx.db, veld.orgId, persoon._id, args.datum),
    ]);
    return { medewerker: { _id: persoon._id, naam: persoon.naam }, segmenten,
      revisie: dag?.revisie ?? 0, status: dag?.status ?? "open" };
  },
});

export const logUrenVoorLosseKracht = mutation({
  args: {
    medewerkerId: v.id("medewerkers"), datum: v.string(), categorie: segmentCategorieValidator,
    beginTijd: v.string(), eindTijd: v.string(), werkitemId: v.optional(v.id("projecten")),
    klantId: v.optional(v.id("klanten")), notitie: v.optional(v.string()), werksoort: v.optional(werksoortValidator),
    sleutel: v.string(), verwachteRevisie: v.number(),
  },
  handler: async (ctx, args) => {
    const veld = await veldContext(ctx);
    assertBeheerder(veld);
    assertSleutel(args.sleutel);
    const persoon = await doelKracht(ctx, veld, args.medewerkerId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.datum) || Number.isNaN(Date.parse(`${args.datum}T00:00:00Z`)) ||
      new Date(`${args.datum}T00:00:00Z`).toISOString().slice(0, 10) !== args.datum) throw new ConvexError("Ongeldige datum.");
    const sleutel = `losse:${args.sleutel}`;
    const invoer = { datum: args.datum, categorie: args.categorie, beginTijd: args.beginTijd,
      eindTijd: args.eindTijd, werkitemId: args.werkitemId, klantId: args.klantId, notitie: args.notitie, werksoort: args.werksoort };
    const payload = JSON.stringify({ medewerkerId: persoon._id, revisie: args.verwachteRevisie, ...invoer });
    const eerder = await ctx.db.query("urenOpdrachten").withIndex("by_org_user_sleutel", (q) =>
      q.eq("orgId", veld.orgId).eq("userId", veld.user._id).eq("sleutel", sleutel)).unique();
    if (eerder) {
      if (eerder.payload !== payload) throw new ConvexError("Deze opdrachtsleutel is gebruikt voor andere uren.");
      return { id: eerder.segmentIds[0], revisie: eerder.revisie };
    }
    const dag = await dagStatusVoor(ctx.db, veld.orgId, persoon._id, args.datum);
    if (!Number.isSafeInteger(args.verwachteRevisie) || args.verwachteRevisie !== (dag?.revisie ?? 0)) {
      throw new ConvexError("De uren zijn intussen gewijzigd. Ververs de dag.");
    }
    if (dag?.status === "ingediend") throw new ConvexError("Deze dag is ingediend. Kantoor moet hem eerst heropenen.");
    const id = await voegSegmentToe(ctx, veld, persoon, { ...invoer, bron: "handmatig" });
    const revisie = (dag?.revisie ?? 0) + 1;
    await ctx.db.insert("urenOpdrachten", {
      orgId: veld.orgId, userId: veld.user._id, medewerkerId: persoon._id,
      datum: args.datum, sleutel, payload, segmentIds: [id], revisie, createdAt: Date.now(),
    });
    return { id, revisie };
  },
});
