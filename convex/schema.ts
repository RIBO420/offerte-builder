import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  aanlegScopeDataValidator,
  onderhoudScopeDataValidator,
} from "./validators";

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

    // Scope data per type - typed validators per offerte type
    scopeData: v.optional(
      v.union(aanlegScopeDataValidator, onderhoudScopeDataValidator)
    ),

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
        margePercentage: v.optional(v.number()), // Override marge per regel
      })
    ),

    // Notities
    notities: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    verzondenAt: v.optional(v.number()),

    // Public sharing
    shareToken: v.optional(v.string()),
    shareExpiresAt: v.optional(v.number()),
    customerResponse: v.optional(
      v.object({
        status: v.union(
          v.literal("bekeken"),
          v.literal("geaccepteerd"),
          v.literal("afgewezen")
        ),
        comment: v.optional(v.string()),
        respondedAt: v.number(),
        viewedAt: v.optional(v.number()),
        signature: v.optional(v.string()), // Base64 signature image
        signedAt: v.optional(v.number()),
      })
    ),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_nummer", ["offerteNummer"])
    .index("by_share_token", ["shareToken"]),

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
    // Per-scope marge percentages (optioneel, fallback naar standaardMargePercentage)
    scopeMarges: v.optional(
      v.object({
        // Aanleg scopes
        grondwerk: v.optional(v.number()),
        bestrating: v.optional(v.number()),
        borders: v.optional(v.number()),
        gras: v.optional(v.number()),
        houtwerk: v.optional(v.number()),
        water_elektra: v.optional(v.number()),
        specials: v.optional(v.number()),
        // Onderhoud scopes
        gras_onderhoud: v.optional(v.number()),
        borders_onderhoud: v.optional(v.number()),
        heggen: v.optional(v.number()),
        bomen: v.optional(v.number()),
        overig: v.optional(v.number()),
      })
    ),
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
    defaultWaarden: v.optional(
      v.union(aanlegScopeDataValidator, onderhoudScopeDataValidator)
    ),
  }).index("by_user", ["userId"]),

  // Offerte messages (chat between business and customer)
  offerte_messages: defineTable({
    offerteId: v.id("offertes"),
    sender: v.union(v.literal("bedrijf"), v.literal("klant")),
    message: v.string(),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_offerte", ["offerteId"])
    .index("by_offerte_unread", ["offerteId", "isRead"]),

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
      scopeData: v.optional(
        v.union(aanlegScopeDataValidator, onderhoudScopeDataValidator)
      ),
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
          margePercentage: v.optional(v.number()),
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

  // ============================================
  // Calculatie, Planning & Nacalculatie Add-on
  // ============================================

  // Projecten - Links offerte to project for planning/nacalculatie
  projecten: defineTable({
    userId: v.id("users"),
    offerteId: v.id("offertes"),
    naam: v.string(),
    status: v.union(
      v.literal("voorcalculatie"),
      v.literal("gepland"),
      v.literal("in_uitvoering"),
      v.literal("afgerond"),
      v.literal("nacalculatie_compleet")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_offerte", ["offerteId"]),

  // Voorcalculaties - Pre-calculation data
  voorcalculaties: defineTable({
    projectId: v.id("projecten"),
    teamGrootte: v.union(v.literal(2), v.literal(3), v.literal(4)),
    teamleden: v.optional(v.array(v.string())),
    effectieveUrenPerDag: v.number(),
    normUrenTotaal: v.number(),
    geschatteDagen: v.number(),
    normUrenPerScope: v.record(v.string(), v.number()), // { "grondwerk": 16, "bestrating": 24, ... }
    createdAt: v.number(),
  }).index("by_project", ["projectId"]),

  // PlanningTaken - Planning tasks per project
  planningTaken: defineTable({
    projectId: v.id("projecten"),
    scope: v.string(),
    taakNaam: v.string(),
    normUren: v.number(),
    geschatteDagen: v.number(),
    volgorde: v.number(), // Order of execution
    status: v.union(
      v.literal("gepland"),
      v.literal("gestart"),
      v.literal("afgerond")
    ),
  }).index("by_project", ["projectId"]),

  // Machines - Machine park
  machines: defineTable({
    userId: v.id("users"),
    naam: v.string(),
    type: v.union(v.literal("intern"), v.literal("extern")),
    tarief: v.number(),
    tariefType: v.union(v.literal("uur"), v.literal("dag")),
    gekoppeldeScopes: v.array(v.string()), // Scopes that auto-trigger this machine
    isActief: v.boolean(),
  }).index("by_user", ["userId"]),

  // UrenRegistraties - Time registrations (imported or manual)
  urenRegistraties: defineTable({
    projectId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD format
    medewerker: v.string(),
    uren: v.number(),
    taakId: v.optional(v.id("planningTaken")),
    scope: v.optional(v.string()),
    notities: v.optional(v.string()),
    bron: v.union(v.literal("import"), v.literal("handmatig")),
  })
    .index("by_project", ["projectId"])
    .index("by_datum", ["datum"]),

  // MachineGebruik - Machine usage per project
  machineGebruik: defineTable({
    projectId: v.id("projecten"),
    machineId: v.id("machines"),
    datum: v.string(), // YYYY-MM-DD format
    uren: v.number(),
    kosten: v.number(),
  }).index("by_project", ["projectId"]),

  // Nacalculaties - Post-calculation results
  nacalculaties: defineTable({
    projectId: v.id("projecten"),
    werkelijkeUren: v.number(),
    werkelijkeDagen: v.number(),
    werkelijkeMachineKosten: v.number(),
    afwijkingUren: v.number(), // werkelijkeUren - normUrenTotaal
    afwijkingPercentage: v.number(), // ((werkelijkeUren - normUrenTotaal) / normUrenTotaal) * 100
    afwijkingenPerScope: v.record(v.string(), v.number()), // { "grondwerk": -2, "bestrating": 4, ... }
    conclusies: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_project", ["projectId"]),

  // Leerfeedback Historie - Audit trail for normuur adjustments
  leerfeedback_historie: defineTable({
    userId: v.id("users"),
    normuurId: v.id("normuren"),
    scope: v.string(),
    activiteit: v.string(),
    oudeWaarde: v.number(),
    nieuweWaarde: v.number(),
    wijzigingPercentage: v.number(),
    reden: v.string(), // "Gemiddelde afwijking over X projecten: Y%"
    bronProjecten: v.array(v.id("projecten")), // Projects used for analysis
    toegepastDoor: v.string(), // User name who applied
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_normuur", ["normuurId"])
    .index("by_scope", ["scope"]),
});
