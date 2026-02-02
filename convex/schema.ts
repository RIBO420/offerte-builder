import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  aanlegScopeDataValidator,
  onderhoudScopeDataValidator,
  userRoleValidator,
} from "./validators";

export default defineSchema({
  // Gebruikers (via Clerk, alleen referentie)
  // Role-based access control (RBAC):
  // - admin: Full access to all features, can manage users, medewerkers, and all data
  // - medewerker: Limited access, can only see own data, linked to a medewerker profile
  // - viewer: Read-only access to allowed features
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    bedrijfsnaam: v.optional(v.string()),
    // Role-based access control - defaults to 'admin' for backwards compatibility
    role: v.optional(userRoleValidator),
    // Link to medewerkers table (for medewerker role)
    // This allows a user to be connected to their medewerker profile
    // enabling them to see only their own time registrations, projects, etc.
    linkedMedewerkerId: v.optional(v.id("medewerkers")),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_role", ["role"])
    .index("by_linked_medewerker", ["linkedMedewerkerId"]),

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
    // Workflow: concept → voorcalculatie → verzonden → geaccepteerd/afgewezen
    // voorcalculatie status means internal pre-calculation is done, ready to send
    // Note: "definitief" is deprecated but kept for backwards compatibility during migration
    status: v.union(
      v.literal("concept"),
      v.literal("definitief"), // DEPRECATED - will be migrated to voorcalculatie
      v.literal("voorcalculatie"),
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

    // Archiving
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),

    // Soft delete
    deletedAt: v.optional(v.number()),
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
    // Factuur instellingen
    factuurNummerPrefix: v.optional(v.string()),
    laatsteFactuurNummer: v.optional(v.number()),
    standaardBetalingstermijn: v.optional(v.number()),
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
      v.literal("bedankt"),
      v.literal("factuur_verzonden"),
      v.literal("factuur_herinnering")
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
  // Projects are created from accepted offertes that have voorcalculatie completed
  // Workflow: gepland → in_uitvoering → afgerond → nacalculatie_compleet
  // Note: "voorcalculatie" is deprecated but kept for backwards compatibility during migration
  projecten: defineTable({
    userId: v.id("users"),
    offerteId: v.id("offertes"),
    naam: v.string(),
    status: v.union(
      v.literal("voorcalculatie"), // DEPRECATED - will be migrated to gepland
      v.literal("gepland"),
      v.literal("in_uitvoering"),
      v.literal("afgerond"),
      v.literal("nacalculatie_compleet"),
      v.literal("gefactureerd")
    ),
    // Toegewezen voertuigen voor dit project (fleet management)
    toegewezenVoertuigen: v.optional(v.array(v.id("voertuigen"))),

    // Archiving
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),

    // Soft delete
    deletedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_offerte", ["offerteId"]),

  // Voorcalculaties - Pre-calculation data
  // Can be linked to either an offerte (before sending) or a project (for legacy/reference)
  // New workflow: voorcalculatie is created at offerte level before sending to client
  voorcalculaties: defineTable({
    offerteId: v.optional(v.id("offertes")), // Link to offerte (new workflow)
    projectId: v.optional(v.id("projecten")), // Link to project (legacy/reference)
    teamGrootte: v.union(v.literal(2), v.literal(3), v.literal(4)),
    teamleden: v.optional(v.array(v.string())),
    effectieveUrenPerDag: v.number(),
    normUrenTotaal: v.number(),
    geschatteDagen: v.number(),
    normUrenPerScope: v.record(v.string(), v.number()), // { "grondwerk": 16, "bestrating": 24, ... }
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_offerte", ["offerteId"]),

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

  // Machines - Machinepark / Wagenpark
  // Beheer van intern en extern gehuurde machines en voertuigen
  // Tarief kan per uur of per dag worden ingesteld
  // gekoppeldeScopes bepaalt welke scopes automatisch deze machine triggeren
  machines: defineTable({
    userId: v.id("users"),
    naam: v.string(),
    type: v.union(v.literal("intern"), v.literal("extern")), // Eigen machines vs. gehuurd
    tarief: v.number(),
    tariefType: v.union(v.literal("uur"), v.literal("dag")),
    gekoppeldeScopes: v.array(v.string()), // Scopes die automatisch deze machine triggeren
    isActief: v.boolean(),
  }).index("by_user", ["userId"]),

  // Medewerkers - Personeelsbeheer
  // Registratie van medewerkers voor planning en urenregistratie
  // Elke medewerker kan een eigen uurtarief hebben (optioneel, anders standaard uurtarief)
  // functie: bijv. "Hovenier", "Voorman", "Leerling", etc.
  medewerkers: defineTable({
    userId: v.id("users"),
    naam: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    functie: v.optional(v.string()), // bijv. "Hovenier", "Voorman", "Leerling"
    uurtarief: v.optional(v.number()), // Optioneel aangepast uurtarief per medewerker
    isActief: v.boolean(),
    notities: v.optional(v.string()),

    // Specialisaties per scope met niveau-indicatie
    specialisaties: v.optional(
      v.array(
        v.object({
          scope: v.string(), // bijv. "grondwerk", "bestrating", "bomen"
          niveau: v.union(
            v.literal("junior"),
            v.literal("midlevel"),
            v.literal("senior")
          ),
          gecertificeerd: v.optional(v.boolean()),
        })
      )
    ),

    // Certificaten met vervaldatum tracking
    certificaten: v.optional(
      v.array(
        v.object({
          naam: v.string(), // bijv. "VCA Basis", "Boomverzorging ETW"
          uitgifteDatum: v.number(), // timestamp
          vervaldatum: v.optional(v.number()), // timestamp (optioneel voor permanente certificaten)
          documentUrl: v.optional(v.string()), // link naar document/scan
        })
      )
    ),

    // Beschikbaarheid voor planning
    beschikbaarheid: v.optional(
      v.object({
        werkdagen: v.array(v.number()), // 0=zondag, 1=maandag, ... 6=zaterdag
        urenPerWeek: v.number(),
        maxUrenPerDag: v.number(),
      })
    ),

    // Contract type voor capaciteitsplanning
    contractType: v.optional(
      v.union(
        v.literal("fulltime"),
        v.literal("parttime"),
        v.literal("zzp"),
        v.literal("seizoen")
      )
    ),

    // Adresgegevens
    adres: v.optional(
      v.object({
        straat: v.string(),
        postcode: v.string(),
        plaats: v.string(),
      })
    ),

    // Noodcontact
    noodcontact: v.optional(
      v.object({
        naam: v.string(),
        telefoon: v.string(),
        relatie: v.string(), // bijv. "Partner", "Ouder", "Kind"
      })
    ),

    // ============================================
    // APP INTEGRATIE VELDEN
    // ============================================
    clerkOrgId: v.optional(v.string()), // Clerk organization ID
    clerkUserId: v.optional(v.string()), // Clerk user ID (na signup in app)
    status: v.optional(
      v.union(
        v.literal("invited"), // Uitnodiging verstuurd
        v.literal("active"), // Actief in app
        v.literal("inactive") // Niet meer actief
      )
    ),
    biometricEnabled: v.optional(v.boolean()), // Face ID/Touch ID actief
    lastLoginAt: v.optional(v.number()), // Laatste login timestamp

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_actief", ["userId", "isActief"])
    .index("by_org", ["clerkOrgId"]) // App: medewerkers per organisatie
    .index("by_clerk_id", ["clerkUserId"]), // App: medewerker opzoeken via Clerk ID

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

    // Offline sync velden (voor medewerkers app)
    idempotencyKey: v.optional(v.string()), // UUID voor deduplicatie
    clientTimestamp: v.optional(v.number()), // Client-side timestamp
    syncStatus: v.optional(
      v.union(
        v.literal("synced"),
        v.literal("pending"),
        v.literal("conflict"),
        v.literal("error")
      )
    ),
    medewerkerClerkId: v.optional(v.string()), // Link naar Clerk user
  })
    .index("by_project", ["projectId"])
    .index("by_datum", ["datum"])
    .index("by_idempotency", ["idempotencyKey"]),

  // MachineGebruik - Machine usage per project
  machineGebruik: defineTable({
    projectId: v.id("projecten"),
    machineId: v.id("machines"),
    datum: v.string(), // YYYY-MM-DD format
    uren: v.number(),
    kosten: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_machine", ["machineId"]),

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

  // ============================================
  // Facturatie
  // ============================================

  // Facturen - Facturen gegenereerd vanuit projecten
  // Een factuur bevat een snapshot van klant- en bedrijfsgegevens op moment van aanmaak
  // Workflow: concept → definitief → verzonden → betaald/vervallen
  // Correcties uit nacalculatie kunnen worden meegenomen als extra regels
  facturen: defineTable({
    projectId: v.id("projecten"),
    userId: v.id("users"),
    factuurnummer: v.string(),
    status: v.union(
      v.literal("concept"),
      v.literal("definitief"),
      v.literal("verzonden"),
      v.literal("betaald"),
      v.literal("vervallen")
    ),

    // Klantgegevens (snapshot op moment van factuur aanmaken)
    klant: v.object({
      naam: v.string(),
      adres: v.string(),
      postcode: v.string(),
      plaats: v.string(),
      email: v.optional(v.string()),
      telefoon: v.optional(v.string()),
    }),

    // Bedrijfsgegevens (snapshot op moment van factuur aanmaken)
    bedrijf: v.object({
      naam: v.string(),
      adres: v.string(),
      postcode: v.string(),
      plaats: v.string(),
      kvk: v.optional(v.string()),
      btw: v.optional(v.string()),
      iban: v.optional(v.string()),
      email: v.optional(v.string()),
      telefoon: v.optional(v.string()),
    }),

    // Factuurregels
    regels: v.array(
      v.object({
        id: v.string(),
        omschrijving: v.string(),
        hoeveelheid: v.number(),
        eenheid: v.string(),
        prijsPerEenheid: v.number(),
        totaal: v.number(),
      })
    ),

    // Correcties (uit nacalculatie afwijkingen)
    correcties: v.optional(
      v.array(
        v.object({
          omschrijving: v.string(),
          bedrag: v.number(),
        })
      )
    ),

    // Financieel
    subtotaal: v.number(),
    btwPercentage: v.number(),
    btwBedrag: v.number(),
    totaalInclBtw: v.number(),

    // Betalingstermijn
    factuurdatum: v.number(),
    vervaldatum: v.number(),
    betalingstermijnDagen: v.number(),

    // Tracking
    verzondenAt: v.optional(v.number()),
    betaaldAt: v.optional(v.number()),
    notities: v.optional(v.string()),

    // Archiving
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_factuurnummer", ["factuurnummer"])
    .index("by_status", ["status"]),

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

  // ============================================
  // Wagenpark (Fleet Management)
  // ============================================

  // Voertuigen - Vehicles in the fleet
  // Supports integration with FleetGo for GPS tracking and data sync
  // Types: bus, bestelwagen, aanhanger, etc.
  voertuigen: defineTable({
    userId: v.id("users"),
    kenteken: v.string(), // Dutch license plate
    merk: v.string(), // Brand: Mercedes, VW, etc.
    model: v.string(), // Model name
    type: v.string(), // bus, bestelwagen, aanhanger, etc.
    bouwjaar: v.optional(v.number()), // Year built
    kleur: v.optional(v.string()), // Color
    fleetgoId: v.optional(v.string()), // External ID from FleetGo
    fleetgoData: v.optional(v.any()), // Raw data from FleetGo API
    laatsteSyncAt: v.optional(v.number()), // Last sync timestamp
    kmStand: v.optional(v.number()), // Current mileage
    status: v.union(
      v.literal("actief"),
      v.literal("inactief"),
      v.literal("onderhoud")
    ),
    notities: v.optional(v.string()),
    // Verzekering en APK gegevens
    apkVervaldatum: v.optional(v.number()), // APK expiry timestamp
    verzekeringsVervaldatum: v.optional(v.number()), // Insurance expiry timestamp
    verzekeraar: v.optional(v.string()), // Insurance company
    polisnummer: v.optional(v.string()), // Policy number
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_kenteken", ["kenteken"])
    .index("by_fleetgo", ["fleetgoId"]),

  // VoertuigOnderhoud - Vehicle maintenance records
  // Track scheduled and completed maintenance tasks
  voertuigOnderhoud: defineTable({
    voertuigId: v.id("voertuigen"),
    userId: v.id("users"),
    type: v.union(
      v.literal("olie"),
      v.literal("apk"),
      v.literal("banden"),
      v.literal("inspectie"),
      v.literal("reparatie"),
      v.literal("overig")
    ),
    omschrijving: v.string(),
    geplanteDatum: v.number(), // Scheduled date timestamp
    voltooidDatum: v.optional(v.number()), // Completion date timestamp
    kosten: v.optional(v.number()), // Cost of maintenance
    status: v.union(
      v.literal("gepland"),
      v.literal("in_uitvoering"),
      v.literal("voltooid")
    ),
    notities: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_voertuig", ["voertuigId"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"]),

  // KilometerStanden - Mileage tracking
  // Log mileage readings for vehicles, optionally linked to projects
  kilometerStanden: defineTable({
    voertuigId: v.id("voertuigen"),
    userId: v.id("users"),
    datum: v.string(), // YYYY-MM-DD format
    kilometerstand: v.number(),
    projectId: v.optional(v.id("projecten")), // Optional link to project
    notities: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_voertuig", ["voertuigId"])
    .index("by_user", ["userId"]),

  // BrandstofRegistratie - Fuel registration
  // Track fuel consumption and costs
  brandstofRegistratie: defineTable({
    voertuigId: v.id("voertuigen"),
    userId: v.id("users"),
    datum: v.number(), // Timestamp
    liters: v.number(),
    kosten: v.number(),
    kilometerstand: v.number(),
    locatie: v.optional(v.string()), // Fuel station location
    createdAt: v.number(),
  })
    .index("by_voertuig", ["voertuigId"])
    .index("by_user", ["userId"]),

  // ============================================
  // Teams (Team Management)
  // ============================================

  // Teams - Groepering van medewerkers voor planning en rapportage
  teams: defineTable({
    userId: v.id("users"),
    naam: v.string(),
    beschrijving: v.optional(v.string()),
    leden: v.array(v.id("medewerkers")), // Array van medewerker IDs
    isActief: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // VoertuigSchades - Damage reports for vehicles
  // Track damages, repairs, and insurance claims
  voertuigSchades: defineTable({
    voertuigId: v.id("voertuigen"),
    userId: v.id("users"),
    datum: v.number(), // Timestamp when damage occurred
    beschrijving: v.string(), // Description of the damage
    ernst: v.union(
      v.literal("klein"),
      v.literal("gemiddeld"),
      v.literal("groot")
    ),
    schadeType: v.union(
      v.literal("deuk"),
      v.literal("kras"),
      v.literal("breuk"),
      v.literal("mechanisch"),
      v.literal("overig")
    ),
    fotoUrls: v.optional(v.array(v.string())), // Photo URLs of damage
    gerapporteerdDoor: v.string(), // Name of person who reported
    status: v.union(
      v.literal("nieuw"),
      v.literal("in_reparatie"),
      v.literal("afgehandeld")
    ),
    reparatieKosten: v.optional(v.number()), // Repair costs
    verzekeringsClaim: v.optional(v.boolean()), // Insurance claim filed
    claimNummer: v.optional(v.string()), // Insurance claim number
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_voertuig", ["voertuigId"])
    .index("by_status", ["status"])
    .index("by_user", ["userId"]),

  // VoertuigUitrusting - Equipment inventory per vehicle
  // Track tools and equipment assigned to vehicles
  voertuigUitrusting: defineTable({
    voertuigId: v.id("voertuigen"),
    userId: v.id("users"),
    naam: v.string(), // Equipment name
    categorie: v.union(
      v.literal("motorgereedschap"),
      v.literal("handgereedschap"),
      v.literal("veiligheid"),
      v.literal("overig")
    ),
    hoeveelheid: v.number(), // Quantity
    serienummer: v.optional(v.string()), // Serial number
    aanschafDatum: v.optional(v.number()), // Purchase date
    aanschafPrijs: v.optional(v.number()), // Purchase price
    status: v.union(
      v.literal("aanwezig"),
      v.literal("vermist"),
      v.literal("defect")
    ),
    notities: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_voertuig", ["voertuigId"])
    .index("by_user", ["userId"]),

  // ============================================
  // CHAT TABELLEN (Medewerkers App)
  // ============================================

  // Team messages - Team chat berichten met channelType, projectId, message, attachments
  team_messages: defineTable({
    senderId: v.id("users"),
    senderName: v.string(),
    senderClerkId: v.string(),
    companyId: v.id("users"),

    channelType: v.union(
      v.literal("team"),
      v.literal("project"),
      v.literal("broadcast")
    ),

    projectId: v.optional(v.id("projecten")),
    channelName: v.string(),

    message: v.string(),
    messageType: v.union(
      v.literal("text"),
      v.literal("image"),
      v.literal("announcement")
    ),

    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentType: v.optional(v.string()),

    isRead: v.boolean(),
    readBy: v.optional(v.array(v.string())),

    createdAt: v.number(),
    editedAt: v.optional(v.number()),
  })
    .index("by_company", ["companyId"])
    .index("by_channel", ["companyId", "channelType"])
    .index("by_project", ["projectId"])
    .index("by_team_unread", ["companyId", "channelType", "isRead"])
    .searchIndex("search_messages", {
      searchField: "message",
      filterFields: ["companyId", "channelType", "projectId"],
    }),

  // Direct messages - Een-op-een berichten
  direct_messages: defineTable({
    fromUserId: v.id("users"),
    fromClerkId: v.string(),
    toUserId: v.id("users"),
    toClerkId: v.string(),
    companyId: v.id("users"),

    message: v.string(),
    messageType: v.union(v.literal("text"), v.literal("image")),

    attachmentStorageId: v.optional(v.id("_storage")),
    attachmentType: v.optional(v.string()),

    isRead: v.boolean(),
    readAt: v.optional(v.number()),

    createdAt: v.number(),
  })
    .index("by_conversation", ["fromClerkId", "toClerkId"])
    .index("by_company", ["companyId"])
    .index("by_recipient_unread", ["toClerkId", "isRead"]),

  // Notification preferences - Push notification instellingen
  notification_preferences: defineTable({
    userId: v.id("users"),
    clerkUserId: v.string(),

    enablePushNotifications: v.boolean(),
    deviceToken: v.optional(v.string()),
    devicePlatform: v.optional(
      v.union(v.literal("ios"), v.literal("android"), v.literal("web"))
    ),

    mutedChannels: v.optional(v.array(v.string())),
    mutedUsers: v.optional(v.array(v.string())),

    // Chat notifications
    notifyOnTeamChat: v.boolean(),
    notifyOnDirectMessage: v.boolean(),
    notifyOnProjectChat: v.boolean(),
    notifyOnBroadcast: v.boolean(),

    // Offerte notifications (admin alerts)
    notifyOnOfferteAccepted: v.optional(v.boolean()), // When customer accepts
    notifyOnOfferteRejected: v.optional(v.boolean()), // When customer rejects
    notifyOnOfferteViewed: v.optional(v.boolean()), // When customer views (optional, can be noisy)
    notifyOnOfferteCreated: v.optional(v.boolean()), // When new offerte is created

    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
    respectQuietHours: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_clerk_id", ["clerkUserId"]),

  // Chat attachments - Media attachments
  chat_attachments: defineTable({
    storageId: v.id("_storage"),
    messageId: v.optional(v.id("team_messages")),
    directMessageId: v.optional(v.id("direct_messages")),

    userId: v.id("users"),
    companyId: v.id("users"),

    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_company", ["companyId"]),

  // ============================================
  // GPS TRACKING TABELLEN (Medewerkers App)
  // ============================================

  // LocationSessions - Voor tracking sessies (clock in/out)
  locationSessions: defineTable({
    userId: v.id("users"),
    medewerkerClerkId: v.string(),
    medewerkerNaam: v.string(),
    projectId: v.optional(v.id("projecten")),

    status: v.union(
      v.literal("clock_in"),
      v.literal("tracking"),
      v.literal("break"),
      v.literal("clock_out")
    ),

    clockInAt: v.number(),
    lastLocationAt: v.number(),
    clockOutAt: v.optional(v.number()),
    breakStartAt: v.optional(v.number()),
    breakEndAt: v.optional(v.number()),

    // Privacy
    consentGiven: v.boolean(),
    consentGivenAt: v.number(),
    privacyLevel: v.union(
      v.literal("full"),
      v.literal("aggregated"),
      v.literal("minimal")
    ),

    createdAt: v.number(),
  })
    .index("by_user_active", ["userId", "status"])
    .index("by_project", ["projectId"])
    .index("by_date", ["clockInAt"]),

  // LocationData - GPS data punten
  locationData: defineTable({
    sessionId: v.id("locationSessions"),
    userId: v.id("users"),
    projectId: v.optional(v.id("projecten")),

    latitude: v.number(),
    longitude: v.number(),
    accuracy: v.number(),
    altitude: v.optional(v.number()),
    speed: v.optional(v.number()),
    heading: v.optional(v.number()),

    source: v.union(
      v.literal("gps"),
      v.literal("network"),
      v.literal("fused")
    ),

    batteryLevel: v.optional(v.number()),
    batteryLow: v.boolean(),

    recordedAt: v.number(),
    receivedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_time", ["recordedAt"]),

  // JobSiteGeofences - Geofence definities per project
  jobSiteGeofences: defineTable({
    userId: v.id("users"),
    projectId: v.id("projecten"),
    customerName: v.string(),
    customerAddress: v.string(),

    centerLatitude: v.number(),
    centerLongitude: v.number(),
    radiusMeters: v.number(),

    polygonPoints: v.optional(
      v.array(
        v.object({
          lat: v.number(),
          lng: v.number(),
        })
      )
    ),

    isActive: v.boolean(),
    autoClockIn: v.boolean(),
    autoClockOut: v.boolean(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"]),

  // GeofenceEvents - Enter/exit/dwell events
  geofenceEvents: defineTable({
    sessionId: v.id("locationSessions"),
    geofenceId: v.id("jobSiteGeofences"),

    eventType: v.union(
      v.literal("enter"),
      v.literal("exit"),
      v.literal("dwell")
    ),

    latitude: v.number(),
    longitude: v.number(),
    accuracy: v.number(),
    dwellTimeSeconds: v.optional(v.number()),

    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_geofence", ["geofenceId"]),

  // Routes - Reis tracking tussen locaties
  routes: defineTable({
    sessionId: v.id("locationSessions"),
    userId: v.id("users"),

    startLocation: v.object({
      latitude: v.number(),
      longitude: v.number(),
      address: v.optional(v.string()),
      timestamp: v.number(),
    }),

    endLocation: v.object({
      latitude: v.number(),
      longitude: v.number(),
      address: v.optional(v.string()),
      timestamp: v.number(),
    }),

    distanceMeters: v.number(),
    durationSeconds: v.number(),
    averageSpeedMps: v.number(),
    maxSpeedMps: v.number(),

    isProjectTravel: v.boolean(),
    travelType: v.union(
      v.literal("to_site"),
      v.literal("from_site"),
      v.literal("between_sites"),
      v.literal("other")
    ),

    pathPoints: v.array(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
        timestamp: v.number(),
      })
    ),

    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  // LocationAnalytics - Dagelijkse aggregaties
  locationAnalytics: defineTable({
    userId: v.id("users"),
    datum: v.string(),

    totalWorkSeconds: v.number(),
    totalBreakSeconds: v.number(),
    totalTravelSeconds: v.number(),
    totalDistanceMeters: v.number(),
    sitesVisited: v.number(),
    locationDataPoints: v.number(),
    averageAccuracyMeters: v.number(),

    medewerkerNaam: v.string(),
    projectId: v.optional(v.id("projecten")),

    createdAt: v.number(),
  })
    .index("by_user_date", ["userId", "datum"])
    .index("by_project", ["projectId"]),

  // LocationAuditLog - GDPR audit trail
  locationAuditLog: defineTable({
    userId: v.id("users"),
    employee: v.optional(v.id("medewerkers")),
    action: v.union(
      v.literal("tracking_started"),
      v.literal("tracking_stopped"),
      v.literal("data_accessed"),
      v.literal("data_exported"),
      v.literal("data_deleted"),
      v.literal("consent_given"),
      v.literal("consent_revoked")
    ),

    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_employee", ["employee"]),

  // ============================================
  // PUSH NOTIFICATIONS
  // ============================================

  // Push tokens - Store Expo push tokens for mobile notifications
  // Supports multiple devices per user
  pushTokens: defineTable({
    userId: v.id("users"),
    clerkUserId: v.string(),
    expoPushToken: v.string(), // Expo push token (e.g., ExponentPushToken[xxx])
    deviceId: v.optional(v.string()), // Optional device identifier for deduplication
    platform: v.union(v.literal("ios"), v.literal("android")),
    isActive: v.boolean(),
    lastUsedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_clerk_id", ["clerkUserId"])
    .index("by_token", ["expoPushToken"]),

  // Push notification logs - Track sent notifications for debugging and analytics
  pushNotificationLogs: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("chat_team"),
      v.literal("chat_dm"),
      v.literal("chat_project"),
      v.literal("chat_broadcast"),
      v.literal("offerte_status"),
      v.literal("project_assignment")
    ),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()), // Additional data payload
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("skipped") // Skipped due to preferences or quiet hours
    ),
    error: v.optional(v.string()),
    ticketId: v.optional(v.string()), // Expo push ticket ID
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

  // Notification log - Track sent notifications for batching and debugging
  // Used to prevent notification spam by tracking recent notifications per user/channel
  notification_log: defineTable({
    recipientClerkId: v.string(),
    senderClerkId: v.string(),
    channelType: v.string(), // "team", "project", "broadcast", "direct"
    projectId: v.optional(v.string()),
    messageId: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed")
    ),
    reason: v.optional(v.string()), // Reason for skipping/failure
    createdAt: v.number(),
  })
    .index("by_recipient_time", ["recipientClerkId", "createdAt"])
    .index("by_message", ["messageId"]),

  // ============================================
  // IN-APP NOTIFICATIONS (Mobile App Notification Center)
  // ============================================

  // Notifications - In-app and push notifications for users
  // Supports: offerte updates, chat messages, project assignments, system announcements
  notifications: defineTable({
    userId: v.id("users"), // The user who should receive this notification
    type: v.union(
      // Offerte notifications
      v.literal("offerte_geaccepteerd"),
      v.literal("offerte_afgewezen"),
      v.literal("offerte_aangemaakt"),
      v.literal("offerte_verzonden"),
      v.literal("offerte_bekeken"),
      // Chat notifications
      v.literal("chat_message"),
      v.literal("chat_dm"),
      v.literal("chat_broadcast"),
      // Project notifications
      v.literal("project_assignment"),
      v.literal("project_status_update"),
      // System notifications
      v.literal("system_announcement"),
      v.literal("system_reminder")
    ),
    title: v.string(),
    message: v.string(),

    // Link to related entities
    offerteId: v.optional(v.id("offertes")),
    offerteNummer: v.optional(v.string()),
    projectId: v.optional(v.id("projecten")),
    projectNaam: v.optional(v.string()),
    klantNaam: v.optional(v.string()),

    // Sender info (for chat messages)
    senderName: v.optional(v.string()),
    senderClerkId: v.optional(v.string()),

    // Read/Dismissed status
    isRead: v.boolean(),
    isDismissed: v.boolean(),
    readAt: v.optional(v.number()),
    dismissedAt: v.optional(v.number()),

    // Push notification tracking
    pushSent: v.optional(v.boolean()),
    pushSentAt: v.optional(v.number()),
    pushError: v.optional(v.string()),

    // Metadata
    triggeredBy: v.optional(v.string()), // "klant" | "systeem" | clerkId
    metadata: v.optional(v.any()), // Additional context data

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_user_not_dismissed", ["userId", "isDismissed"])
    .index("by_user_type", ["userId", "type"])
    .index("by_offerte", ["offerteId"])
    .index("by_project", ["projectId"]),
});
