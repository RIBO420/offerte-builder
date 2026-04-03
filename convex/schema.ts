import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  aanlegScopeDataValidator,
  onderhoudScopeDataValidator,
  tuintypologieValidator,
  userRoleValidator,
} from "./validators";

/**
 * KNOWN SCHEMA TYPE INCONSISTENCIES (from parallel agent development):
 *
 * These fields have different types across tables. This is documented
 * for future cleanup but left as-is to avoid breaking existing data.
 *
 * - adres: string (8 tables) vs optional (2 tables: leveranciers, medewerkers)
 * - beschrijving: string (4 tables) vs optional (4 tables)
 * - btw: number (2 tables) vs optional (2 tables)
 * - voertuigId: id (3 tables) vs optional (3 tables)
 * - projectId: id (some) vs optional (some)
 *
 * TODO: Standardize these in a future migration.
 */

export default defineSchema({
  // Gebruikers (via Clerk, alleen referentie)
  // Role-based access control (RBAC) — 7-role model:
  // - directie: Full access (replaces old "admin")
  // - projectleider: Manage projects, offertes, klanten, planning
  // - voorman: Manage field work, uren, toolbox
  // - medewerker: Own uren, verlof, chat, assigned projects
  // - klant: Read own offertes/facturen/projects (replaces old "viewer")
  // - onderaannemer_zzp: Own uren, assigned projects, own facturen
  // - materiaalman: Manage voorraad, wagenpark, inkoop
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    bedrijfsnaam: v.optional(v.string()),
    // Role-based access control - defaults to 'medewerker' for safety
    role: v.optional(userRoleValidator),
    // Link to medewerkers table (for medewerker role)
    // This allows a user to be connected to their medewerker profile
    // enabling them to see only their own time registrations, projects, etc.
    linkedMedewerkerId: v.optional(v.id("medewerkers")),
    linkedKlantId: v.optional(v.id("klanten")),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_linked_medewerker", ["linkedMedewerkerId"])
    .index("by_linked_klant", ["linkedKlantId"]),

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
    // CRM pipeline lifecycle status (CRM-002)
    pipelineStatus: v.optional(v.union(
      v.literal("lead"),
      v.literal("offerte_verzonden"),
      v.literal("getekend"),
      v.literal("in_uitvoering"),
      v.literal("opgeleverd"),
      v.literal("onderhoud"),
    )),
    // CRM-003: Klant type segmentatie
    klantType: v.optional(v.union(
      v.literal("particulier"),
      v.literal("zakelijk"),
      v.literal("vve"),
      v.literal("gemeente"),
      v.literal("overig"),
    )),
    // CRM-003: Vrije tags voor segmentatie
    tags: v.optional(v.array(v.string())),
    // CRM-005: Opvolgherinneringen op klant-niveau
    reminderSnoozed: v.optional(v.boolean()),
    lastReminderAt: v.optional(v.number()),
    // CRM-008: GDPR anonimisatie tracking
    gdprAnonymized: v.optional(v.boolean()),
    gdprAnonymizedAt: v.optional(v.number()),
    gdprAnonymizedBy: v.optional(v.id("users")),
    // Klantenportaal fields
    clerkUserId: v.optional(v.string()),
    portalEnabled: v.optional(v.boolean()),
    lastLoginAt: v.optional(v.number()),
    invitationToken: v.optional(v.string()),
    invitationExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_pipeline_status", ["userId", "pipelineStatus"])
    .index("by_klant_type", ["userId", "klantType"])
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_email", ["email"])
    .index("by_invitation_token", ["invitationToken"])
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
      klantvriendelijkheid: v.optional(v.number()), // 1-5 schaal
      afstandVanLoods: v.optional(v.number()), // km
      tuintypologie: v.optional(tuintypologieValidator),
      typeWerkzaamheden: v.optional(v.array(v.string())),
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
        interneNotitie: v.optional(v.string()), // Interne notitie, niet zichtbaar voor klant
        optioneel: v.optional(v.boolean()), // Optionele post — klant kan aan/uit zetten
      })
    ),

    // Notities
    notities: v.optional(v.string()),

    // Garantiepakket koppeling
    garantiePakketId: v.optional(v.id("garantiePakketten")),

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
        selectedOptionalRegelIds: v.optional(v.array(v.string())), // IDs van optionele regels die klant heeft gekozen
      })
    ),

    // Archiving
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // CRM Lead koppeling
    leadId: v.optional(v.id("configuratorAanvragen")),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_nummer", ["offerteNummer"])
    .index("by_share_token", ["shareToken"])
    .index("by_lead", ["leadId"])
    // Index for klant-scoped queries (klanten.ts: getById, delete, anonymize — 8+ queries)
    .index("by_klant", ["klantId"])
    // Compound indexes for archived/deleted filtering (offertes.ts: list, stats, dashboard)
    .index("by_user_archived", ["userId", "isArchived"])
    .index("by_user_deleted", ["userId", "deletedAt"]),

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
    // Index for active-only product queries (voorraad.ts: inventarisatie)
    .index("by_user_actief", ["userId", "isActief"])
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
    updatedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_scope", ["userId", "scope"]),

  // Correctiefactoren (systeem defaults + user overrides)
  correctiefactoren: defineTable({
    userId: v.optional(v.id("users")), // null = systeem default
    type: v.string(), // bereikbaarheid, complexiteit, hoogteverschil, etc.
    waarde: v.string(), // goed, beperkt, slecht, laag, gemiddeld, hoog
    factor: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_user_type", ["userId", "type"])
    .index("by_type", ["type"])
    // Compound index to avoid .filter on waarde after by_user_type (correctiefactoren.ts)
    .index("by_user_type_waarde", ["userId", "type", "waarde"]),

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
        reiniging: v.optional(v.number()),
        bemesting: v.optional(v.number()),
        gazonanalyse: v.optional(v.number()),
        mollenbestrijding: v.optional(v.number()),
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
    // Deelfactuur templates (FAC-002)
    // Bijv. [{naam: "50/30/20", stappen: [{percentage: 50, label: "Vooraf"}, ...]}]
    deelfactuurTemplates: v.optional(v.array(v.object({
      id: v.string(),
      naam: v.string(),
      stappen: v.array(v.object({
        percentage: v.number(),
        label: v.string(),
      })),
    }))),
    // Herinneringen & aanmaningen instellingen (FAC-006, FAC-007)
    herinneringInstellingen: v.optional(
      v.object({
        herinneringDagen: v.optional(v.array(v.number())),
        aanmaningDagen: v.optional(v.array(v.number())),
        automatischVersturen: v.optional(v.boolean()),
      })
    ),
    // Creditnota nummering (FAC-008)
    laatsteCreditnotaNummer: v.optional(v.number()),
    // Algemene voorwaarden PDF (EML-003)
    voorwaardenPdfId: v.optional(v.id("_storage")),
    voorwaardenPdfNaam: v.optional(v.string()),
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
      v.literal("geopend"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained")
    ),
    resendId: v.optional(v.string()), // Resend message ID for tracking
    error: v.optional(v.string()),
    customMessage: v.optional(v.string()), // Persoonlijk bericht bij email
    cc: v.optional(v.string()), // CC emailadres
    createdAt: v.number(),
    openedAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    bouncedAt: v.optional(v.number()),
    clickedAt: v.optional(v.number()),
  })
    .index("by_offerte", ["offerteId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_resendId", ["resendId"]),

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
        klantvriendelijkheid: v.optional(v.number()), // 1-5 schaal
        afstandVanLoods: v.optional(v.number()), // km
        tuintypologie: v.optional(v.string()), // snapshot als string
        typeWerkzaamheden: v.optional(v.array(v.string())),
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
      v.literal("teruggedraaid"),
      v.literal("nieuwe_versie")
    ),
    omschrijving: v.string(), // Human readable beschrijving
    createdAt: v.number(),
  })
    .index("by_offerte", ["offerteId"])
    .index("by_offerte_versie", ["offerteId", "versieNummer"])
    .index("by_user", ["userId"]),

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
    klantId: v.optional(v.id("klanten")),
    naam: v.string(),
    status: v.union(
      v.literal("voorcalculatie"), // DEPRECATED - will be migrated to gepland
      v.literal("gepland"),
      v.literal("in_uitvoering"),
      v.literal("afgerond"),
      v.literal("nacalculatie_compleet"),
      v.literal("gefactureerd")
    ),
    // Toegewezen medewerkers voor dit project (team assignment)
    toegewezenMedewerkerIds: v.optional(v.array(v.id("medewerkers"))),
    // Toegewezen voertuigen voor dit project (fleet management)
    toegewezenVoertuigen: v.optional(v.array(v.id("voertuigen"))),

    // Deelfactuur schema per project (FAC-001)
    // Bijv. [{percentage: 50, label: "Vooraf"}, {percentage: 30, label: "Bij start"}, {percentage: 20, label: "Bij oplevering"}]
    deelfactuurSchema: v.optional(v.array(v.object({
      percentage: v.number(),
      label: v.string(),
    }))),

    // KLIC-melding check for aanleg projects with grondwerk scope (PRJ-W01)
    // Legally required before starting excavation work
    klicMeldingGedaan: v.optional(v.boolean()),

    // Archiving
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),

    // Soft delete
    deletedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_offerte", ["offerteId"])
    // Compound indexes for archived/deleted filtering (projecten.ts: list, search, stats)
    .index("by_user_archived", ["userId", "isArchived"])
    .index("by_user_deleted", ["userId", "deletedAt"])
    .index("by_klant", ["klantId"]),

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
    updatedAt: v.optional(v.number()),
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
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_status", ["status"])
    // Compound index for project-scoped status filtering (voormanDashboard.ts, weekPlanning.ts)
    .index("by_project_status", ["projectId", "status"]),

  // WeekPlanning — Medewerker-project-dag toewijzingen voor weekplanning
  weekPlanning: defineTable({
    medewerkerId: v.id("medewerkers"),
    projectId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD
    uren: v.optional(v.number()), // Geplande uren (default: volle dag)
    voertuigId: v.optional(v.id("voertuigen")), // Bus/voertuig toewijzing (PLN-003)
    notities: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_datum", ["datum"])
    .index("by_medewerker", ["medewerkerId"])
    .index("by_medewerker_datum", ["medewerkerId", "datum"])
    .index("by_project", ["projectId"])
    .index("by_datum_project", ["datum", "projectId"]),

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
  })
    .index("by_user", ["userId"])
    // Index for active-only machine queries (machines.ts: getForScopes, getStatistics; weekPlanning.ts)
    .index("by_user_actief", ["userId", "isActief"]),

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
    .index("by_status", ["status"])
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
    medewerkerId: v.optional(v.id("medewerkers")), // Typed reference to medewerkers table
  })
    .index("by_project", ["projectId"])
    .index("by_project_datum", ["projectId", "datum"])
    .index("by_datum", ["datum"])
    .index("by_idempotency", ["idempotencyKey"])
    // Index for medewerker-scoped queries (urenRegistraties.ts, mobile.ts, medewerkerAnalytics.ts)
    .index("by_medewerker", ["medewerker"])
    // Compound index for medewerker + datum filtering (dashboard queries, week summaries)
    .index("by_medewerker_datum", ["medewerker", "datum"])
    // Index for clerkId-based lookups from mobile app
    .index("by_medewerker_clerk", ["medewerkerClerkId"])
    // Index for typed medewerker ID lookups
    .index("by_medewerker_id", ["medewerkerId"]),

  // MachineGebruik - Machine usage per project
  machineGebruik: defineTable({
    projectId: v.id("projecten"),
    machineId: v.id("machines"),
    datum: v.string(), // YYYY-MM-DD format
    uren: v.number(),
    kosten: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_datum", ["projectId", "datum"])
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

  // Meerwerk - Extra werk bovenop de originele offerte (FAC-003)
  // Status: aangevraagd → goedgekeurd → gefactureerd / afgewezen
  meerwerk: defineTable({
    projectId: v.id("projecten"),
    userId: v.id("users"),
    omschrijving: v.string(),
    reden: v.optional(v.string()),
    regels: v.array(v.object({
      id: v.string(),
      omschrijving: v.string(),
      hoeveelheid: v.number(),
      eenheid: v.string(),
      prijsPerEenheid: v.number(),
      totaal: v.number(),
    })),
    totaalExclBtw: v.number(),
    status: v.union(
      v.literal("aangevraagd"),
      v.literal("goedgekeurd"),
      v.literal("afgewezen"),
      v.literal("gefactureerd"),
    ),
    goedgekeurdDoor: v.optional(v.string()),
    goedgekeurdAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Facturen - Facturen gegenereerd vanuit projecten
  // Een factuur bevat een snapshot van klant- en bedrijfsgegevens op moment van aanmaak
  // Workflow: concept → definitief → verzonden → betaald/vervallen
  // Correcties uit nacalculatie kunnen worden meegenomen als extra regels
  facturen: defineTable({
    projectId: v.id("projecten"),
    userId: v.id("users"),
    klantId: v.optional(v.id("klanten")),
    factuurnummer: v.string(),
    status: v.union(
      v.literal("concept"),
      v.literal("definitief"),
      v.literal("verzonden"),
      v.literal("betaald"),
      v.literal("vervallen")
    ),

    // Factuur type: regulier (volledig/deelfactuur) of meerwerk (FAC-003)
    factuurType: v.optional(v.union(
      v.literal("regulier"),
      v.literal("meerwerk"),
    )),

    // Deelfacturatie (FAC-001)
    isDeelfactuur: v.optional(v.boolean()),
    deelfactuurNummer: v.optional(v.number()), // 1, 2, 3... volgnummer binnen project
    deelfactuurPercentage: v.optional(v.number()), // percentage van totaal offertebedrag
    deelfactuurLabel: v.optional(v.string()), // bijv. "Vooraf", "Bij start", "Bij oplevering"

    // Meerwerk referentie (FAC-003)
    meerwerkId: v.optional(v.id("meerwerk")),

    // Creditnota velden (FAC-008)
    isCreditnota: v.optional(v.boolean()),
    referentieFactuurId: v.optional(v.id("facturen")),
    creditnotaReden: v.optional(v.string()),

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

    // Boekhouding sync tracking (MOD-014)
    externalBookkeepingId: v.optional(v.string()), // ID in extern boekhoudsysteem
    boekhoudSyncStatus: v.optional(v.union(
      v.literal("not_synced"),
      v.literal("pending"),
      v.literal("synced"),
      v.literal("error"),
    )),
    boekhoudSyncAt: v.optional(v.number()), // Laatste sync timestamp

    // Archiving
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_factuurnummer", ["factuurnummer"])
    .index("by_status", ["status"])
    .index("by_referentieFactuur", ["referentieFactuurId"])
    // Compound index for user-scoped status queries (betalingsherinneringen.ts, users.ts)
    .index("by_user_status", ["userId", "status"])
    // Index for boekhouding sync queries (boekhouding.ts: getSyncStatus, markForSync)
    .index("by_user_boekhoudSync", ["userId", "boekhoudSyncStatus"])
    .index("by_klant", ["klantId"]),

  // Betalingsherinneringen & Aanmaningen (FAC-006, FAC-007)
  betalingsherinneringen: defineTable({
    factuurId: v.id("facturen"),
    userId: v.id("users"),
    type: v.union(
      v.literal("herinnering"),
      v.literal("eerste_aanmaning"),
      v.literal("tweede_aanmaning"),
      v.literal("ingebrekestelling")
    ),
    volgnummer: v.number(),
    dagenVervallen: v.number(),
    verstuurdAt: v.number(),
    emailVerstuurd: v.optional(v.boolean()),
    notities: v.optional(v.string()),
  })
    .index("by_factuur", ["factuurId"])
    .index("by_user", ["userId"]),

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
    fleetgoData: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))), // Raw data from FleetGo API
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
    .index("by_status", ["status"])
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
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"]),

  // BrandstofRegistratie - Fuel registration
  // Track fuel consumption and costs
  brandstofRegistratie: defineTable({
    voertuigId: v.id("voertuigen"),
    userId: v.id("users"),
    datum: v.string(), // YYYY-MM-DD format (consistent with other tables)
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
  })
    .index("by_user", ["userId"])
    // Index for active-only team queries (teams.ts: list, teamOverzicht)
    .index("by_user_actief", ["userId", "isActief"]),

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
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // ============================================
  // CHAT TABELLEN (Medewerkers App)
  // ============================================

  // Team messages - Team chat berichten met channelType, projectId, message, attachments
  team_messages: defineTable({
    senderId: v.id("users"),
    senderName: v.string(),
    senderClerkId: v.string(),
    senderRole: v.optional(v.string()),
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
    .index("by_user", ["userId"])
    .index("by_user_active", ["userId", "status"])
    .index("by_status", ["status"])
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
    .index("by_session_time", ["sessionId", "recordedAt"])
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
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
    .index("by_user", ["userId"])
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
  // WERKLOCATIES (Jobsite Information)
  // ============================================

  // Werklocaties - Gedetailleerde locatie-informatie per project
  // Bevat toegangsinformatie, utilities, veiligheidsnotities en foto's
  werklocaties: defineTable({
    userId: v.id("users"),
    projectId: v.id("projecten"),
    // Locatie details
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    coordinates: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      })
    ),
    // Access informatie
    toegangInstructies: v.optional(v.string()),
    parkeerInfo: v.optional(v.string()),
    sleutelInfo: v.optional(v.string()),
    contactOpLocatie: v.optional(
      v.object({
        naam: v.optional(v.string()),
        telefoon: v.optional(v.string()),
      })
    ),
    // Utilities
    waterAansluiting: v.optional(v.boolean()),
    stroomAansluiting: v.optional(v.boolean()),
    toiletBeschikbaar: v.optional(v.boolean()),
    // Safety
    veiligheidsNotities: v.optional(v.string()),
    bijzonderheden: v.optional(v.string()),
    // Foto's (URLs naar opgeslagen bestanden)
    fotos: v.optional(
      v.array(
        v.object({
          url: v.string(),
          beschrijving: v.optional(v.string()),
          type: v.optional(
            v.union(v.literal("voor"), v.literal("tijdens"), v.literal("na"))
          ),
          createdAt: v.number(),
        })
      )
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"]),

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

  // Unified notification delivery log — tracks all delivery attempts across channels
  // Replaces pushNotificationLogs (push-specific) and notification_log (chat anti-spam)
  notificationDeliveryLog: defineTable({
    userId: v.id("users"), // Normalized user reference (not clerkId)
    channel: v.union(
      v.literal("push"),
      v.literal("chat"),
      v.literal("email")
    ),
    type: v.string(), // Notification type (e.g., "chat_team", "chat_dm", "offerte_status", "project_assignment")
    status: v.union(
      v.literal("sent"),
      v.literal("skipped"),
      v.literal("failed"),
      v.literal("delivered")
    ),

    // Push-specific fields
    ticketId: v.optional(v.string()), // Expo push ticket ID
    title: v.optional(v.string()), // Push notification title
    body: v.optional(v.string()), // Push notification body

    // Chat-specific fields
    messageId: v.optional(v.string()), // Chat message ID for deduplication
    channelType: v.optional(v.string()), // Chat channel: "team", "project", "broadcast", "direct"

    // Shared optional fields
    error: v.optional(v.string()), // Error message on failure
    reason: v.optional(v.string()), // Reason for skipping (e.g., quiet hours, prefs disabled, anti-spam)
    data: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))), // Additional payload data
    projectId: v.optional(v.string()), // Related project ID
    senderUserId: v.optional(v.id("users")), // Who triggered the notification

    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_status", ["status"])
    .index("by_channel", ["channel", "createdAt"]),

  // Push notification logs - Track sent notifications for debugging and analytics
  // DEPRECATED: migrate to notificationDeliveryLog
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
    data: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))), // Additional data payload (DEPRECATED: migrate to notificationDeliveryLog)
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
  // DEPRECATED: migrate to notificationDeliveryLog
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
    .index("by_message", ["messageId"])
    .index("by_status", ["status"]),

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
      v.literal("offerte_herinnering"),
      // Chat notifications
      v.literal("chat_message"),
      v.literal("chat_dm"),
      v.literal("chat_broadcast"),
      // Project notifications
      v.literal("project_assignment"),
      v.literal("project_status_update"),
      v.literal("budget_warning"),
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
    metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))), // Additional context data

    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_user_not_dismissed", ["userId", "isDismissed"])
    .index("by_user_type", ["userId", "type"])
    .index("by_offerte", ["offerteId"])
    .index("by_project", ["projectId"]),

  // ============================================
  // Leveranciers & Inkoopbeheer
  // ============================================

  // Leveranciers - Supplier management
  leveranciers: defineTable({
    userId: v.id("users"),
    naam: v.string(),
    contactpersoon: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    adres: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    kvkNummer: v.optional(v.string()),
    btwNummer: v.optional(v.string()),
    iban: v.optional(v.string()),
    betalingstermijn: v.optional(v.number()), // dagen
    notities: v.optional(v.string()),
    isActief: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .searchIndex("search_leveranciers", {
      searchField: "naam",
      filterFields: ["userId"],
    }),

  // Inkooporders - Purchase orders
  inkooporders: defineTable({
    userId: v.id("users"),
    leverancierId: v.id("leveranciers"),
    projectId: v.optional(v.id("projecten")),
    orderNummer: v.string(),
    status: v.union(
      v.literal("concept"),
      v.literal("besteld"),
      v.literal("geleverd"),
      v.literal("gefactureerd")
    ),
    regels: v.array(
      v.object({
        id: v.string(),
        productId: v.optional(v.id("producten")),
        omschrijving: v.string(),
        hoeveelheid: v.number(),
        eenheid: v.string(),
        prijsPerEenheid: v.number(),
        totaal: v.number(),
      })
    ),
    totaal: v.number(),
    notities: v.optional(v.string()),
    besteldAt: v.optional(v.number()),
    verwachteLevertijd: v.optional(v.number()),
    geleverdAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_leverancier", ["leverancierId"])
    .index("by_project", ["projectId"]),

  // ============================================
  // VOORRAAD / STOCK MANAGEMENT
  // ============================================

  // Voorraad - Stock levels per product per user
  // Tracks current inventory with min/max levels for reorder alerts
  voorraad: defineTable({
    userId: v.id("users"),
    productId: v.id("producten"),
    categorie: v.optional(v.string()), // Denormalized from producten for efficient category queries
    hoeveelheid: v.number(),
    minVoorraad: v.optional(v.number()), // reorder point
    maxVoorraad: v.optional(v.number()),
    locatie: v.optional(v.string()), // magazijn locatie
    laatsteBijwerking: v.number(),
    notities: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_product", ["userId", "productId"])
    .index("by_user_category", ["userId", "categorie"]),

  // VoorraadMutaties - Stock movements/transactions
  // Tracks all inventory changes: purchases, consumption, corrections, returns
  voorraadMutaties: defineTable({
    userId: v.id("users"),
    voorraadId: v.id("voorraad"),
    productId: v.id("producten"),
    type: v.union(
      v.literal("inkoop"),
      v.literal("verbruik"),
      v.literal("correctie"),
      v.literal("retour")
    ),
    hoeveelheid: v.number(), // positief voor inkoop, negatief voor verbruik
    projectId: v.optional(v.id("projecten")),
    inkooporderId: v.optional(v.id("inkooporders")),
    notities: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_voorraad", ["voorraadId"])
    .index("by_product", ["productId"])
    .index("by_project", ["projectId"]),

  // ============================================
  // Real-time Cost Tracking & Quality Control
  // ============================================

  // ProjectKosten - Real-time cost tracking per project
  // Track material, labor, machine, and other costs during project execution
  projectKosten: defineTable({
    userId: v.id("users"),
    projectId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD
    type: v.union(
      v.literal("materiaal"),
      v.literal("arbeid"),
      v.literal("machine"),
      v.literal("overig")
    ),
    omschrijving: v.string(),
    bedrag: v.number(),
    scope: v.optional(v.string()),
    medewerker: v.optional(v.string()),
    leverancierId: v.optional(v.id("leveranciers")),
    factuurNummer: v.optional(v.string()),
    notities: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_project_type", ["projectId", "type"])
    .index("by_project_date", ["projectId", "datum"]),

  // KwaliteitsControles - Quality control checklists per project/scope
  // Track quality inspections with checklist items, photos, and approval workflow
  kwaliteitsControles: defineTable({
    userId: v.id("users"),
    projectId: v.id("projecten"),
    scope: v.string(),
    checklistItems: v.array(
      v.object({
        id: v.string(),
        omschrijving: v.string(),
        isAfgevinkt: v.boolean(),
        afgevinktAt: v.optional(v.number()),
        afgevinktDoor: v.optional(v.string()),
        notities: v.optional(v.string()),
      })
    ),
    status: v.union(
      v.literal("open"),
      v.literal("in_uitvoering"),
      v.literal("goedgekeurd"),
      v.literal("afgekeurd")
    ),
    opmerkingen: v.optional(v.string()),
    goedgekeurdDoor: v.optional(v.string()),
    goedgekeurdAt: v.optional(v.number()),
    fotos: v.optional(
      v.array(
        v.object({
          url: v.string(),
          beschrijving: v.optional(v.string()),
          type: v.union(v.literal("voor"), v.literal("na")),
          createdAt: v.number(),
        })
      )
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_status", ["status"])
    .index("by_project_status", ["projectId", "status"])
    // Compound index for user-scoped status queries (materiaalmanDashboard.ts, realtime.ts)
    .index("by_user_status", ["userId", "status"]),

  // ============================================
  // Afvalverwerkers & Transportbedrijven
  // ============================================

  // Afvalverwerkers - Beheer van afvalverwerkers met locatie en tarieven
  afvalverwerkers: defineTable({
    userId: v.id("users"),
    naam: v.string(),
    adres: v.string(),
    lat: v.number(),
    lng: v.number(),
    tariefPerTon: v.number(),
    contactInfo: v.optional(v.string()),
    isActief: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Transportbedrijven - Beheer van transportbedrijven met locatie en km-tarieven
  transportbedrijven: defineTable({
    userId: v.id("users"),
    naam: v.string(),
    adres: v.string(),
    lat: v.number(),
    lng: v.number(),
    kmTarief: v.number(),
    contactInfo: v.optional(v.string()),
    isActief: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ============================================
  // Garantiepakketten
  // ============================================

  // GarantiePakketten - Garantie-opties per tier voor offertes
  garantiePakketten: defineTable({
    userId: v.id("users"),
    naam: v.string(),
    tier: v.union(v.literal("basis"), v.literal("premium"), v.literal("premium_plus")),
    duurJaren: v.number(),
    maxCallbacks: v.number(),
    prijs: v.number(),
    beschrijving: v.string(),
    features: v.optional(v.array(v.string())),
    isActief: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_tier", ["tier"]),

  // ============================================
  // Configurator Aanvragen & Betalingen
  // ============================================

  // ConfiguratorAanvragen - Online aanvragen via de klantconfigurator
  // Klanten kunnen zelfstandig een aanvraag doen voor gazon, boomschors of verticuteren
  // Workflow: nieuw → in_behandeling → goedgekeurd/afgekeurd → voltooid
  configuratorAanvragen: defineTable({
    type: v.union(v.literal("gazon"), v.literal("boomschors"), v.literal("verticuteren"), v.literal("contact")),
    status: v.union(
      v.literal("nieuw"),
      v.literal("in_behandeling"),
      v.literal("goedgekeurd"),
      v.literal("afgekeurd"),
      v.literal("voltooid")
    ),
    referentie: v.string(),
    klantNaam: v.string(),
    klantEmail: v.string(),
    klantTelefoon: v.string(),
    klantAdres: v.string(),
    klantPostcode: v.string(),
    klantHuisnummer: v.optional(v.string()),
    klantPlaats: v.string(),
    // Type-specifieke data per aanvraagtype:
    // - gazon: oppervlakte, typeGras, ondergrond, drainage, opsluitbanden, etc.
    // - boomschors: boomschorsType, oppervlakte, laagDikte, m3Nodig, bezorging, etc.
    // - verticuteren: oppervlakte, conditie, bijzaaien, topdressing, bemesting, etc.
    // - contact: onderwerp, bericht, aantalFotos
    // - handmatig (empty): {}
    specificaties: v.union(
      v.object({
        oppervlakte: v.number(),
        typeGras: v.string(),
        ondergrond: v.string(),
        drainage: v.boolean(),
        opsluitbanden: v.boolean(),
        opsluitbandenMeters: v.number(),
        poortbreedte: v.number(),
        handmatigToeslag: v.optional(v.boolean()),
        gewensteStartdatum: v.optional(v.union(v.string(), v.null())),
        prijsDetails: v.optional(v.object({
          subtotaalExBtw: v.number(),
          btw: v.number(),
          totaalInclBtw: v.number(),
        })),
      }),
      v.object({
        boomschorsType: v.string(),
        oppervlakte: v.number(),
        laagDikte: v.string(),
        m3Nodig: v.number(),
        bezorging: v.boolean(),
        bezorgPostcode: v.optional(v.string()),
        leveringsDatum: v.optional(v.union(v.string(), v.null())),
        opmerkingen: v.optional(v.union(v.string(), v.null())),
      }),
      v.object({
        oppervlakte: v.number(),
        conditie: v.string(),
        bijzaaien: v.boolean(),
        topdressing: v.boolean(),
        bemesting: v.boolean(),
        poortBreedte: v.number(),
        gewensteDatum: v.optional(v.union(v.string(), v.null())),
        opmerkingen: v.optional(v.union(v.string(), v.null())),
      }),
      v.object({
        onderwerp: v.string(),
        bericht: v.string(),
        aantalFotos: v.optional(v.number()),
        tuinoppervlak: v.optional(v.string()),
        heeftOntwerp: v.optional(v.string()),
        onderhoudFrequentie: v.optional(v.string()),
        reinigingOpties: v.optional(v.array(v.string())),
        hoeGevonden: v.optional(v.string()),
      }),
      // Empty object for handmatige leads
      v.object({})
    ),
    indicatiePrijs: v.number(),
    definitievePrijs: v.optional(v.number()),
    betalingId: v.optional(v.string()), // Mollie payment reference
    betalingStatus: v.optional(
      v.union(v.literal("open"), v.literal("betaald"), v.literal("mislukt"))
    ),
    notities: v.optional(v.string()),
    toegewezenAan: v.optional(v.id("users")),
    verificatieNotities: v.optional(v.string()),
    fotoIds: v.optional(v.array(v.id("_storage"))),
    // Pipeline/CRM fields
    pipelineStatus: v.optional(v.union(
      v.literal("nieuw"),
      v.literal("contact_gehad"),
      v.literal("offerte_verstuurd"),
      v.literal("gewonnen"),
      v.literal("verloren")
    )),
    bron: v.optional(v.union(
      v.literal("configurator_gazon"),
      v.literal("configurator_boomschors"),
      v.literal("configurator_verticuteren"),
      v.literal("website_contact"),
      v.literal("handmatig"),
      v.literal("telefoon"),
      v.literal("email"),
      v.literal("doorverwijzing")
    )),
    verliesReden: v.optional(v.string()),
    gekoppeldKlantId: v.optional(v.id("klanten")),
    geschatteWaarde: v.optional(v.number()),
    omschrijving: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_referentie", ["referentie"])
    .index("by_pipeline_status", ["pipelineStatus"])
    .index("by_gekoppeld_klant", ["gekoppeldKlantId"])
    // Index for assigned user queries (configuratorAanvragen.ts: toewijzen)
    .index("by_toegewezen", ["toegewezenAan"])
    // Compound index for type + status filtering (configuratorAanvragen.ts: list queries)
    .index("by_type_status", ["type", "status"]),

  // Lead activiteiten - Activiteitenlog voor CRM pipeline
  leadActiviteiten: defineTable({
    leadId: v.id("configuratorAanvragen"),
    type: v.union(
      v.literal("status_wijziging"),
      v.literal("notitie"),
      v.literal("toewijzing"),
      v.literal("offerte_gekoppeld"),
      v.literal("aangemaakt")
    ),
    beschrijving: v.string(),
    gebruikerId: v.optional(v.id("users")),
    metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
    createdAt: v.number(),
  }).index("by_lead", ["leadId", "createdAt"]),

  // Betalingen - Mollie betaalverzoeken gekoppeld aan aanvragen
  betalingen: defineTable({
    userId: v.id("users"),
    molliePaymentId: v.string(),
    bedrag: v.number(),
    status: v.union(
      v.literal("open"),
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("expired"),
      v.literal("canceled")
    ),
    beschrijving: v.string(),
    referentie: v.string(),
    klantNaam: v.string(),
    klantEmail: v.string(),
    type: v.union(
      v.literal("aanbetaling"),
      v.literal("configurator"),
      v.literal("factuur")
    ),
    metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_mollieId", ["molliePaymentId"])
    .index("by_referentie", ["referentie"])
    .index("by_status", ["status"]),

  // ============================================
  // Plantsoorten
  // ============================================

  // Plantsoorten - Plantendatabase met systeem defaults en user overrides
  plantsoorten: defineTable({
    userId: v.optional(v.id("users")), // null = systeem defaults
    naam: v.string(),
    type: v.string(), // bodembedekker, heester, boom, etc.
    lichtbehoefte: v.union(v.literal("zon"), v.literal("halfschaduw"), v.literal("schaduw")),
    bodemvoorkeur: v.string(),
    prijsIndicatie: v.number(),
    omschrijving: v.optional(v.string()),
    isActief: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_lichtbehoefte", ["lichtbehoefte"]),

  // ============================================
  // Offerte Reminders — Automatische follow-up herinneringen
  // ============================================

  offerte_reminders: defineTable({
    offerteId: v.id("offertes"),
    userId: v.id("users"),
    type: v.union(
      v.literal("niet_bekeken"),
      v.literal("niet_gereageerd"),
      v.literal("laatste")
    ),
    scheduledAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("cancelled")
    ),
    sentAt: v.optional(v.number()),
    emailSentAt: v.optional(v.number()), // When the reminder email was sent to the client
    emailError: v.optional(v.string()), // Error message if email sending failed
  })
    .index("by_offerte", ["offerteId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_status_scheduled", ["status", "scheduledAt"]),

  // ============================================
  // HR MODULE — Verlof, Verzuim, Toolbox
  // ============================================

  verlofaanvragen: defineTable({
    userId: v.id("users"),
    medewerkerId: v.id("medewerkers"),
    startDatum: v.string(),
    eindDatum: v.string(),
    aantalDagen: v.number(),
    type: v.union(v.literal("vakantie"), v.literal("bijzonder"), v.literal("onbetaald"), v.literal("compensatie")),
    opmerking: v.optional(v.string()),
    status: v.union(v.literal("aangevraagd"), v.literal("goedgekeurd"), v.literal("afgekeurd")),
    behandeldDoor: v.optional(v.id("users")),
    behandeldOp: v.optional(v.number()),
    afwijzingReden: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_medewerker", ["medewerkerId"])
    .index("by_status", ["status"])
    .index("by_medewerker_status", ["medewerkerId", "status"])
    .index("by_user_status", ["userId", "status"]),

  verzuimregistraties: defineTable({
    userId: v.id("users"),
    medewerkerId: v.id("medewerkers"),
    startDatum: v.string(),
    herstelDatum: v.optional(v.string()),
    reden: v.optional(v.string()),
    notities: v.optional(v.string()),
    verzuimgesprek: v.optional(v.object({ datum: v.string(), notities: v.string(), afspraken: v.optional(v.string()) })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_medewerker", ["medewerkerId"])
    .index("by_user_active", ["userId", "herstelDatum"]),

  // Toolbox-meetings — Wettelijk verplichte veiligheidsbijeenkomsten
  toolboxMeetings: defineTable({
    userId: v.id("users"),
    datum: v.string(), // YYYY-MM-DD
    onderwerp: v.string(),
    beschrijving: v.optional(v.string()),
    aanwezigen: v.array(v.id("medewerkers")), // Minimaal 1 verplicht
    notities: v.optional(v.string()),
    projectId: v.optional(v.id("projecten")), // Optioneel gekoppeld aan project
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_datum", ["userId", "datum"])
    .index("by_project", ["projectId"]),

  // ============================================
  // ONDERHOUDSCONTRACTEN & SLA (MOD-009)
  // ============================================

  // Onderhoudscontracten — recurring maintenance contracts per klant
  onderhoudscontracten: defineTable({
    userId: v.id("users"),
    klantId: v.id("klanten"),

    // Contractidentificatie
    contractNummer: v.string(), // e.g. "OHC-2026-001"
    naam: v.string(), // Descriptive name

    // Locatiegegevens (kan afwijken van klantadres)
    locatie: v.object({
      adres: v.string(),
      postcode: v.string(),
      plaats: v.string(),
      notities: v.optional(v.string()),
    }),

    // Looptijd
    startDatum: v.string(), // YYYY-MM-DD
    eindDatum: v.string(), // YYYY-MM-DD
    opzegtermijnDagen: v.number(),

    // Financieel
    tariefPerTermijn: v.number(), // Bedrag excl. BTW per betalingstermijn
    betalingsfrequentie: v.union(
      v.literal("maandelijks"),
      v.literal("per_kwartaal"),
      v.literal("halfjaarlijks"),
      v.literal("jaarlijks")
    ),
    jaarlijksTarief: v.number(), // Berekend totaaltarief per jaar excl. BTW

    // Indexatie
    indexatiePercentage: v.optional(v.number()),
    laatsteIndexatieDatum: v.optional(v.string()),

    // Status
    status: v.union(
      v.literal("concept"),
      v.literal("actief"),
      v.literal("verlopen"),
      v.literal("opgezegd")
    ),

    // Verlenging
    autoVerlenging: v.boolean(),
    verlengingsPeriodeInMaanden: v.optional(v.number()),

    // Opmerkingen
    notities: v.optional(v.string()),
    voorwaarden: v.optional(v.string()),

    // Soft delete & archiving
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_klant", ["klantId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_einddatum", ["eindDatum"])
    .index("by_contractnummer", ["contractNummer"]),

  // ContractWerkzaamheden — work items per contract, grouped by season
  contractWerkzaamheden: defineTable({
    contractId: v.id("onderhoudscontracten"),

    // Werkzaamheid
    omschrijving: v.string(),
    scope: v.optional(v.string()), // Link to onderhoud scope type

    // Seizoen & frequentie
    seizoen: v.union(
      v.literal("voorjaar"),
      v.literal("zomer"),
      v.literal("herfst"),
      v.literal("winter")
    ),
    frequentie: v.number(), // Times per season
    frequentieEenheid: v.optional(v.union(
      v.literal("per_seizoen"),
      v.literal("per_maand"),
      v.literal("per_week")
    )),

    // Ureninschatting
    geschatteUrenPerBeurt: v.number(),
    geschatteUrenTotaal: v.number(), // geschatteUrenPerBeurt * frequentie

    // Volgorde
    volgorde: v.number(),

    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_contract", ["contractId"])
    .index("by_contract_seizoen", ["contractId", "seizoen"]),

  // ContractFacturen — invoice schedule per contract term
  contractFacturen: defineTable({
    contractId: v.id("onderhoudscontracten"),
    factuurId: v.optional(v.id("facturen")),
    userId: v.id("users"),

    // Termijninformatie
    termijnNummer: v.number(),
    periodeStart: v.string(), // YYYY-MM-DD
    periodeEinde: v.string(), // YYYY-MM-DD
    bedrag: v.number(), // Bedrag excl. BTW

    // Status
    status: v.union(
      v.literal("gepland"),
      v.literal("gefactureerd"),
      v.literal("betaald")
    ),

    createdAt: v.number(),
  })
    .index("by_contract", ["contractId"])
    .index("by_factuur", ["factuurId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_contract_status", ["contractId", "status"]),

  // ============================================
  // Garantiebeheer & Servicemeldingen (MOD-010)
  // ============================================

  // Garanties — Operationele garantie-tracking per opgeleverd project
  // Different from garantiePakketten (offerte-level guarantee tiers for upsell)
  // This tracks actual warranty periods after project delivery
  garanties: defineTable({
    userId: v.id("users"),
    projectId: v.id("projecten"),
    klantId: v.id("klanten"),

    // Garantieperiode
    startDatum: v.string(), // YYYY-MM-DD (= opleverdatum project)
    eindDatum: v.string(), // YYYY-MM-DD (= startDatum + garantiePeriode)
    garantiePeriodeInMaanden: v.number(), // Standaard 12

    // Status
    status: v.union(
      v.literal("actief"),
      v.literal("verlopen"),
    ),

    // Voorwaarden
    voorwaarden: v.optional(v.string()),

    // Notities
    notities: v.optional(v.string()),

    // Soft delete
    deletedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .index("by_klant", ["klantId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_einddatum", ["eindDatum"]),

  // Servicemeldingen — Klachten en serviceverzoeken van klanten
  servicemeldingen: defineTable({
    userId: v.id("users"),
    klantId: v.id("klanten"),
    projectId: v.optional(v.id("projecten")),
    garantieId: v.optional(v.id("garanties")),

    // Inhoud
    beschrijving: v.string(),

    // Garantie of betaald
    isGarantie: v.boolean(),

    // Status workflow: nieuw -> in_behandeling -> ingepland -> afgehandeld
    status: v.union(
      v.literal("nieuw"),
      v.literal("in_behandeling"),
      v.literal("ingepland"),
      v.literal("afgehandeld"),
    ),

    // Prioriteit
    prioriteit: v.union(
      v.literal("laag"),
      v.literal("normaal"),
      v.literal("hoog"),
      v.literal("urgent"),
    ),

    // Foto's
    fotos: v.optional(v.array(v.string())),

    // Contact info
    contactInfo: v.optional(v.string()),

    // Kosten (bij niet-garantie serviceverzoeken)
    kosten: v.number(), // 0 if garantie

    // Soft delete
    deletedAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_klant", ["klantId"])
    .index("by_project", ["projectId"])
    .index("by_garantie", ["garantieId"])
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_prioriteit", ["userId", "prioriteit"]),

  // ServiceAfspraken — Ingeplande servicebezoeken gekoppeld aan een melding
  serviceAfspraken: defineTable({
    meldingId: v.id("servicemeldingen"),
    userId: v.id("users"),

    // Planning
    datum: v.string(), // YYYY-MM-DD
    medewerkerIds: v.array(v.id("medewerkers")),

    // Details
    notities: v.optional(v.string()),

    // Status
    status: v.union(
      v.literal("gepland"),
      v.literal("uitgevoerd"),
      v.literal("geannuleerd"),
    ),

    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_melding", ["meldingId"])
    .index("by_user", ["userId"])
    .index("by_datum", ["datum"])
    .index("by_status", ["status"]),

  // ============================================
  // E-MAIL TEMPLATES (EML-001)
  // ============================================

  // Database-driven email templates replacing hardcoded src/emails/ templates
  // Supports variable interpolation: {{klantNaam}}, {{offerteNummer}}, etc.
  emailTemplates: defineTable({
    userId: v.id("users"),
    naam: v.string(),                    // Template name
    trigger: v.string(),                 // When to use: offerte_verzonden, factuur_verzonden, herinnering_1, herinnering_2, herinnering_3, aanmaning_1, aanmaning_2, ingebrekestelling, oplevering, contract_verlenging
    onderwerp: v.string(),               // Email subject line (supports variables)
    inhoud: v.string(),                  // Email body (HTML, supports variables)
    variabelen: v.array(v.string()),     // Available variables for this template
    actief: v.boolean(),                 // Is this template active?
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_trigger", ["userId", "trigger"])
    .index("by_actief", ["userId", "actief"]),

  // ============================================
  // BOEKHOUDKOPPELING (MOD-014)
  // ============================================

  // BoekhoudInstellingen - Provider configuratie per bedrijf
  // Bevat provider credentials, sync-instellingen en grootboekmappings
  boekhoudInstellingen: defineTable({
    userId: v.id("users"),

    // Provider selectie
    provider: v.union(
      v.literal("moneybird"),
      v.literal("exact_online"),
      v.literal("twinfield"),
      v.literal("geen"), // Niet gekoppeld
    ),

    // OAuth / API credentials (encrypted at rest by Convex)
    apiKey: v.optional(v.string()),         // API key (for simple auth)
    accessToken: v.optional(v.string()),    // OAuth access token
    refreshToken: v.optional(v.string()),   // OAuth refresh token
    tokenExpiresAt: v.optional(v.number()), // Token expiry timestamp

    // Bedrijfs-ID bij provider
    externalBedrijfsId: v.optional(v.string()), // Division/administration ID

    // Synchronisatie-instellingen
    autoSync: v.boolean(), // Automatisch facturen pushen bij verzenden
    syncRichting: v.union(
      v.literal("push"),          // Alleen van ons naar boekhouding
      v.literal("pull"),          // Alleen van boekhouding naar ons
      v.literal("bidirectioneel"), // Beide richtingen
    ),

    // Grootboekrekening mappings
    grootboekMappings: v.optional(v.array(v.object({
      interneCategorie: v.string(),       // "omzet_aanleg", "omzet_onderhoud", "materialen", etc.
      externGrootboekId: v.string(),      // ID bij provider
      externGrootboekNaam: v.string(),    // Naam voor weergave
      externGrootboekNummer: v.optional(v.string()), // Rekeningnummer
    }))),

    // BTW-codes mapping
    btwMappings: v.optional(v.array(v.object({
      internPercentage: v.number(),  // 21, 9, 0
      externBtwId: v.string(),       // BTW-code ID bij provider
      externBtwNaam: v.string(),
    }))),

    // Status
    isActief: v.boolean(),
    laatsteSyncAt: v.optional(v.number()),
    laatsteSyncStatus: v.optional(v.union(
      v.literal("success"),
      v.literal("error"),
      v.literal("partial"),
    )),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_provider", ["provider"]),

  // BoekhoudSync - Synchronisatielogboek per factuur/transactie
  // Audit trail voor alle sync-operaties naar externe boekhoudpakketten
  boekhoudSync: defineTable({
    userId: v.id("users"),

    // Interne referentie
    factuurId: v.optional(v.id("facturen")),
    inkooporderId: v.optional(v.id("inkooporders")),
    entityType: v.union(
      v.literal("factuur"),
      v.literal("creditnota"),
      v.literal("betaling"),
      v.literal("inkoopfactuur"),
      v.literal("contact"), // Klant sync
    ),

    // Externe referentie
    externalId: v.optional(v.string()),    // ID bij de boekhouding provider
    externalUrl: v.optional(v.string()),   // Deep link naar de provider UI

    // Sync status
    syncStatus: v.union(
      v.literal("pending"),    // Wacht op sync
      v.literal("syncing"),    // Bezig met synchroniseren
      v.literal("synced"),     // Succesvol gesynchroniseerd
      v.literal("error"),      // Fout bij synchronisatie
      v.literal("skipped"),    // Overgeslagen
    ),
    syncRichting: v.union(v.literal("push"), v.literal("pull")),

    // Provider
    provider: v.string(), // moneybird, exact_online, twinfield

    // Error tracking
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),

    // Timestamps
    lastSyncAt: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_factuur", ["factuurId"])
    .index("by_external", ["externalId"])
    .index("by_status", ["syncStatus"])
    .index("by_user_status", ["userId", "syncStatus"])
    .index("by_entity_type", ["userId", "entityType"]),

  // ============================================
  // Unified Chat (Klantenportaal)
  // ============================================

  // Unified chat threads — replaces offerte_messages, team_messages, direct_messages
  chat_threads: defineTable({
    type: v.union(
      v.literal("klant"),
      v.literal("team"),
      v.literal("direct"),
      v.literal("project")
    ),
    klantId: v.optional(v.id("klanten")),
    offerteId: v.optional(v.id("offertes")),
    projectId: v.optional(v.id("projecten")),
    channelName: v.optional(v.string()),
    participants: v.array(v.string()),
    lastMessageAt: v.optional(v.number()),
    lastMessagePreview: v.optional(v.string()),
    unreadByBedrijf: v.optional(v.number()),
    unreadByKlant: v.optional(v.number()),
    companyUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_company", ["companyUserId"])
    .index("by_klant", ["klantId"])
    .index("by_offerte", ["offerteId"])
    .index("by_project", ["projectId"])
    .index("by_company_type", ["companyUserId", "type"])
    .index("by_company_last_message", ["companyUserId", "lastMessageAt"]),

  // Unified chat messages
  chat_messages: defineTable({
    threadId: v.id("chat_threads"),
    senderType: v.union(
      v.literal("bedrijf"),
      v.literal("klant"),
      v.literal("medewerker")
    ),
    senderUserId: v.string(),
    senderName: v.string(),
    message: v.string(),
    attachmentStorageIds: v.optional(v.array(v.id("_storage"))),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId", "createdAt"])
    .index("by_thread_unread", ["threadId", "isRead"]),
});
