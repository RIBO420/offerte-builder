import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const bedrijfsgegevensValidator = v.object({
  naam: v.string(),
  adres: v.string(),
  postcode: v.string(),
  plaats: v.string(),
  kvk: v.optional(v.string()),
  btw: v.optional(v.string()),
  iban: v.optional(v.string()),
  email: v.optional(v.string()),
  telefoon: v.optional(v.string()),
  logo: v.optional(v.string()),
});

// Get settings for user
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Get settings by Clerk ID (convenience function)
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) return null;

    return await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

// Create default settings for new user
export const createDefaults = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("instellingen", {
      userId: args.userId,
      uurtarief: 45.0,
      standaardMargePercentage: 15,
      btwPercentage: 21,
      bedrijfsgegevens: {
        naam: "",
        adres: "",
        postcode: "",
        plaats: "",
      },
      offerteNummerPrefix: "OFF-",
      laatsteOfferteNummer: 0,
    });
  },
});

// Update settings
export const update = mutation({
  args: {
    userId: v.id("users"),
    uurtarief: v.optional(v.number()),
    standaardMargePercentage: v.optional(v.number()),
    btwPercentage: v.optional(v.number()),
    bedrijfsgegevens: v.optional(bedrijfsgegevensValidator),
    offerteNummerPrefix: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!settings) {
      throw new Error("Settings not found. Create defaults first.");
    }

    const updates: Record<string, unknown> = {};
    if (args.uurtarief !== undefined) updates.uurtarief = args.uurtarief;
    if (args.standaardMargePercentage !== undefined)
      updates.standaardMargePercentage = args.standaardMargePercentage;
    if (args.btwPercentage !== undefined)
      updates.btwPercentage = args.btwPercentage;
    if (args.bedrijfsgegevens !== undefined)
      updates.bedrijfsgegevens = args.bedrijfsgegevens;
    if (args.offerteNummerPrefix !== undefined)
      updates.offerteNummerPrefix = args.offerteNummerPrefix;

    await ctx.db.patch(settings._id, updates);
    return settings._id;
  },
});

// Get next offerte number and increment counter
export const getNextOfferteNummer = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!settings) {
      throw new Error("Settings not found");
    }

    const nextNumber = settings.laatsteOfferteNummer + 1;
    const year = new Date().getFullYear();
    const offerteNummer = `${settings.offerteNummerPrefix}${year}-${String(nextNumber).padStart(3, "0")}`;

    await ctx.db.patch(settings._id, {
      laatsteOfferteNummer: nextNumber,
    });

    return offerteNummer;
  },
});
