import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Gebruikers (via Clerk, alleen referentie)
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    bedrijfsnaam: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // Klanten
  klanten: defineTable({
    userId: v.id("users"),
    naam: v.string(),
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .searchIndex("search_klanten", {
      searchField: "naam",
      filterFields: ["userId"],
    }),

  // Offertes
  offertes: defineTable({
    userId: v.id("users"),
    klantId: v.optional(v.id("klanten")), // Link to klanten table
    type: v.union(v.literal("aanleg"), v.literal("onderhoud")),
    status: v.union(
      v.literal("concept"),
      v.literal("definitief"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
    offerteNummer: v.string(),

    // Klantgegevens
    klant: v.object({
      naam: v.string(),
      adres: v.string(),
      postcode: v.string(),
      plaats: v.string(),
      email: v.optional(v.string()),
      telefoon: v.optional(v.string()),
    }),

    // Algemene parameters
    algemeenParams: v.object({
      bereikbaarheid: v.union(
        v.literal("goed"),
        v.literal("beperkt"),
        v.literal("slecht")
      ),
      achterstalligheid: v.optional(
        v.union(v.literal("laag"), v.literal("gemiddeld"), v.literal("hoog"))
      ),
    }),

    // Geselecteerde scopes (voor aanleg)
    scopes: v.optional(v.array(v.string())),

    // Scope data per type - flexible object voor scope-specifieke data
    scopeData: v.optional(v.any()),

    // Berekende totalen
    totalen: v.object({
      materiaalkosten: v.number(),
      arbeidskosten: v.number(),
      totaalUren: v.number(),
      subtotaal: v.number(),
      marge: v.number(),
      margePercentage: v.number(),
      totaalExBtw: v.number(),
      btw: v.number(),
      totaalInclBtw: v.number(),
    }),

    // Regels/posten
    regels: v.array(
      v.object({
        id: v.string(),
        scope: v.string(),
        omschrijving: v.string(),
        eenheid: v.string(),
        hoeveelheid: v.number(),
        prijsPerEenheid: v.number(),
        totaal: v.number(),
        type: v.union(
          v.literal("materiaal"),
          v.literal("arbeid"),
          v.literal("machine")
        ),
      })
    ),

    // Notities
    notities: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    verzondenAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_nummer", ["offerteNummer"]),

  // Prijsboek
  producten: defineTable({
    userId: v.id("users"),
    productnaam: v.string(),
    categorie: v.string(),
    inkoopprijs: v.number(),
    verkoopprijs: v.number(),
    eenheid: v.string(),
    leverancier: v.optional(v.string()),
    verliespercentage: v.number(),
    isActief: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_categorie", ["userId", "categorie"])
    .searchIndex("search_producten", {
      searchField: "productnaam",
      filterFields: ["userId", "categorie"],
    }),

  // Normuren
  normuren: defineTable({
    userId: v.id("users"),
    activiteit: v.string(),
    scope: v.string(),
    normuurPerEenheid: v.number(),
    eenheid: v.string(),
    omschrijving: v.optional(v.string()),
  }).index("by_user_scope", ["userId", "scope"]),

  // Correctiefactoren (systeem defaults + user overrides)
  correctiefactoren: defineTable({
    userId: v.optional(v.id("users")), // null = systeem default
    type: v.string(), // bereikbaarheid, complexiteit, hoogteverschil, etc.
    waarde: v.string(), // goed, beperkt, slecht, laag, gemiddeld, hoog
    factor: v.number(),
  }).index("by_user_type", ["userId", "type"]),

  // Instellingen
  instellingen: defineTable({
    userId: v.id("users"),
    uurtarief: v.number(),
    standaardMargePercentage: v.number(),
    btwPercentage: v.number(),
    bedrijfsgegevens: v.object({
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
    }),
    offerteNummerPrefix: v.string(),
    laatsteOfferteNummer: v.number(),
  }).index("by_user", ["userId"]),

  // Standaardtuinen (templates)
  standaardtuinen: defineTable({
    userId: v.optional(v.id("users")), // null = systeem templates
    naam: v.string(),
    omschrijving: v.optional(v.string()),
    type: v.union(v.literal("aanleg"), v.literal("onderhoud")),
    scopes: v.array(v.string()),
    defaultWaarden: v.any(), // Pre-filled scope data
  }).index("by_user", ["userId"]),

  // Email logs
  email_logs: defineTable({
    offerteId: v.id("offertes"),
    userId: v.id("users"),
    type: v.union(
      v.literal("offerte_verzonden"),
      v.literal("herinnering"),
      v.literal("bedankt")
    ),
    to: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("verzonden"),
      v.literal("mislukt"),
      v.literal("geopend")
    ),
    resendId: v.optional(v.string()), // Resend message ID for tracking
    error: v.optional(v.string()),
    createdAt: v.number(),
    openedAt: v.optional(v.number()),
  })
    .index("by_offerte", ["offerteId"])
    .index("by_user", ["userId"]),

  // Offerte versies (versiegeschiedenis)
  offerte_versions: defineTable({
    offerteId: v.id("offertes"),
    userId: v.id("users"),
    versieNummer: v.number(),
    // Snapshot van de offerte op dit moment
    snapshot: v.object({
      status: v.string(),
      klant: v.object({
        naam: v.string(),
        adres: v.string(),
        postcode: v.string(),
        plaats: v.string(),
        email: v.optional(v.string()),
        telefoon: v.optional(v.string()),
      }),
      algemeenParams: v.object({
        bereikbaarheid: v.string(),
        achterstalligheid: v.optional(v.string()),
      }),
      scopes: v.optional(v.array(v.string())),
      scopeData: v.optional(v.any()),
      totalen: v.object({
        materiaalkosten: v.number(),
        arbeidskosten: v.number(),
        totaalUren: v.number(),
        subtotaal: v.number(),
        marge: v.number(),
        margePercentage: v.number(),
        totaalExBtw: v.number(),
        btw: v.number(),
        totaalInclBtw: v.number(),
      }),
      regels: v.array(
        v.object({
          id: v.string(),
          scope: v.string(),
          omschrijving: v.string(),
          eenheid: v.string(),
          hoeveelheid: v.number(),
          prijsPerEenheid: v.number(),
          totaal: v.number(),
          type: v.string(),
        })
      ),
      notities: v.optional(v.string()),
    }),
    // Audit info
    actie: v.union(
      v.literal("aangemaakt"),
      v.literal("gewijzigd"),
      v.literal("status_gewijzigd"),
      v.literal("regels_gewijzigd"),
      v.literal("teruggedraaid")
    ),
    omschrijving: v.string(), // Human readable beschrijving
    createdAt: v.number(),
  })
    .index("by_offerte", ["offerteId"])
    .index("by_offerte_versie", ["offerteId", "versieNummer"]),
});
