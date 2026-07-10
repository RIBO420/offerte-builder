/**
 * Servicemeldingen — het melding/case-object van het interne bord (PRD §2.4).
 *
 * Ombouw van het oude garantiebord (MOD-010) naar het PRD-meldingobject:
 * type (serviceverzoek/klacht/schade), kanaal, precies één verplichte
 * eigenaar, status nieuw → in_behandeling → wacht_op_derden → opgelost,
 * routing-defaults per type en promotie melding → werkitem.
 *
 * ── Toegangsmodel (PRD §1.2, hard — zelfde regel als de klanttijdlijn) ────
 * Meldingen zijn een INTERN KANTOORBORD: de klant-rol krijgt op ELKE query
 * en mutation een AuthError (requireInterneRol). Stafrollen lezen; muteren
 * is kantoor-only (requireKantoor). Klant-instroom via het portaal volgt in
 * fase 2 op hetzelfde object en hetzelfde bord.
 *
 * ── Tijdlijn-koppeling (PRD §2.4) ─────────────────────────────────────────
 * Elke melding en elke statuswissel logt automatisch op de klanttijdlijn
 * (logTijdlijnEvent, kanaal "systeem") én als systeem-entry in de interne
 * case-thread (meldingComments, zie convex/caseThread.ts).
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { verifyOwnership } from "./auth";
import { getCompanyUserId, isKantoorRol, normalizeRole, requireKantoor } from "./roles";
import { logTijdlijnEvent, requireInterneRol } from "./tijdlijn";
import { Doc, Id } from "./_generated/dataModel";

// Status validator — PRD-statussen + legacy (ingepland/afgehandeld, MOD-010)
const statusValidator = v.union(
  v.literal("nieuw"),
  v.literal("in_behandeling"),
  v.literal("wacht_op_derden"),
  v.literal("opgelost"),
  v.literal("ingepland"),
  v.literal("afgehandeld")
);

export const meldingTypeValidator = v.union(
  v.literal("serviceverzoek"),
  v.literal("klacht"),
  v.literal("schade")
);

export const meldingKanaalValidator = v.union(
  v.literal("telefoon"),
  v.literal("whatsapp"),
  v.literal("email"),
  v.literal("portaal"),
  v.literal("intern")
);

const prioriteitValidator = v.union(
  v.literal("laag"),
  v.literal("normaal"),
  v.literal("hoog"),
  v.literal("urgent")
);

// ============================================
// Pure helpers (unit-testbaar zonder ctx)
// ============================================

export type MeldingStatus = Doc<"servicemeldingen">["status"];
export type MeldingType = NonNullable<Doc<"servicemeldingen">["type"]>;
export type BordKolom =
  | "nieuw"
  | "in_behandeling"
  | "wacht_op_derden"
  | "opgelost";

/** Escalatie-default (PRD §2.1): zonder actie na 7 dagen kleurt de taak op. */
export const DEFAULT_ESCALATIE_DAGEN = 7;

/**
 * Bordkolom voor een status: de vier PRD-kolommen; legacy-statussen van het
 * oude garantiebord worden getoond in in_behandeling resp. opgelost.
 */
export function bordKolomVoorStatus(status: MeldingStatus): BordKolom {
  switch (status) {
    case "ingepland":
      return "in_behandeling";
    case "afgehandeld":
      return "opgelost";
    default:
      return status;
  }
}

/** Open = alles wat niet in de kolom "opgelost" staat (teller-badge). */
export function isOpenMelding(status: MeldingStatus): boolean {
  return bordKolomVoorStatus(status) !== "opgelost";
}

/**
 * Routing-defaults bij aanmaak (PRD §2.4):
 * - klacht       → eigenaar = een kantoor-gebruiker (kiezer met default);
 * - serviceverzoek → vlag "beoordelen voor planning-wachtrij";
 * - schade       → kantoor + verzekeringsvlag.
 */
export function routingDefaultsVoorType(type: MeldingType): {
  eigenaarMoetKantoorZijn: boolean;
  beoordelenVoorPlanning: boolean;
  verzekeringsvlag: boolean;
} {
  return {
    eigenaarMoetKantoorZijn: type === "klacht" || type === "schade",
    beoordelenVoorPlanning: type === "serviceverzoek",
    verzekeringsvlag: type === "schade",
  };
}

/**
 * Escalatie (PRD §2.1, §8.12): een open plantaak zonder actie (updatedAt)
 * na X dagen (instelbaar per taak, default 7) kleurt op het bord — geen mail.
 */
export function isGeescaleerd(
  melding: Pick<
    Doc<"servicemeldingen">,
    "taaksoort" | "status" | "updatedAt" | "escalatieDagen"
  >,
  now: number = Date.now()
): boolean {
  if (melding.taaksoort !== "plantaak") return false;
  if (!isOpenMelding(melding.status)) return false;
  const dagen = melding.escalatieDagen ?? DEFAULT_ESCALATIE_DAGEN;
  return now - melding.updatedAt > dagen * 24 * 60 * 60 * 1000;
}

/** Systeem-comment in de interne case-thread (aanmaak/statuswissel/promotie). */
export async function voegSysteemCommentToe(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    meldingId: Id<"servicemeldingen">;
    tekst: string;
  }
): Promise<void> {
  await ctx.db.insert("meldingComments", {
    userId: args.userId,
    meldingId: args.meldingId,
    auteurNaam: "Systeem",
    tekst: args.tekst,
    systeem: true,
    createdAt: Date.now(),
  });
}

/** Eigenaar valideren: bestaat, en (bij klacht/schade) een kantoor-rol. */
async function valideerEigenaar(
  ctx: QueryCtx | MutationCtx,
  eigenaarId: Id<"users">,
  moetKantoorZijn: boolean
): Promise<Doc<"users">> {
  const eigenaar = await ctx.db.get(eigenaarId);
  if (!eigenaar) throw new ConvexError("Eigenaar niet gevonden");
  if (normalizeRole(eigenaar.role) === "klant") {
    throw new ConvexError("Een klantaccount kan geen eigenaar van een melding zijn");
  }
  if (moetKantoorZijn && !isKantoorRol(eigenaar.role)) {
    throw new ConvexError(
      "Voor dit meldingstype moet de eigenaar een kantoor-gebruiker zijn"
    );
  }
  return eigenaar;
}

// ============================================
// QUERIES
// ============================================

/**
 * List all meldingen with optional filters.
 */
export const list = query({
  args: {
    status: v.optional(statusValidator),
    klantId: v.optional(v.id("klanten")),
    prioriteit: v.optional(prioriteitValidator),
  },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    let meldingen;
    if (args.status) {
      meldingen = await ctx.db
        .query("servicemeldingen")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", companyUserId).eq("status", args.status!)
        )
        .collect();
    } else {
      meldingen = await ctx.db
        .query("servicemeldingen")
        .withIndex("by_user", (q) => q.eq("userId", companyUserId))
        .collect();
    }

    // Filter soft-deleted + expliciete bedrijfsscope (belt & braces)
    let result = meldingen.filter(
      (m) => !m.deletedAt && m.userId.toString() === companyUserId.toString()
    );
    if (args.status) {
      result = result.filter((m) => m.status === args.status);
    }

    // Apply additional filters
    if (args.klantId) {
      result = result.filter(
        (m) => m.klantId.toString() === args.klantId!.toString()
      );
    }
    if (args.prioriteit) {
      result = result.filter((m) => m.prioriteit === args.prioriteit);
    }

    // Enrich with klant and project data
    const enriched = await Promise.all(
      result.map(async (m) => {
        const klant = await ctx.db.get(m.klantId);
        const project = m.projectId ? await ctx.db.get(m.projectId) : null;
        return {
          ...m,
          klantNaam: klant?.naam ?? "Onbekend",
          projectNaam: project?.naam ?? null,
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single melding by ID with all related data.
 */
export const getById = query({
  args: { id: v.id("servicemeldingen") },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);
    const melding = await ctx.db.get(args.id);
    if (!melding || melding.userId.toString() !== companyUserId.toString()) {
      return null;
    }

    const klant = await ctx.db.get(melding.klantId);
    const project = melding.projectId
      ? await ctx.db.get(melding.projectId)
      : null;
    const garantie = melding.garantieId
      ? await ctx.db.get(melding.garantieId)
      : null;

    // Get service afspraken
    const afspraken = await ctx.db
      .query("serviceAfspraken")
      .withIndex("by_melding", (q) => q.eq("meldingId", args.id))
      .collect();

    // Enrich afspraken with medewerker names
    const enrichedAfspraken = await Promise.all(
      afspraken.map(async (a) => {
        const medewerkerNames = await Promise.all(
          a.medewerkerIds.map(async (id) => {
            const med = await ctx.db.get(id);
            return med?.naam ?? "Onbekend";
          })
        );
        return {
          ...a,
          medewerkerNamen: medewerkerNames,
        };
      })
    );

    const eigenaar = melding.eigenaarId
      ? await ctx.db.get(melding.eigenaarId)
      : null;
    const werkitem = melding.werkitemId
      ? await ctx.db.get(melding.werkitemId)
      : null;

    return {
      ...melding,
      klantNaam: klant?.naam ?? "Onbekend",
      klantAdres: klant
        ? `${klant.adres}, ${klant.postcode} ${klant.plaats}`
        : "",
      klantEmail: klant?.email ?? "",
      klantTelefoon: klant?.telefoon ?? "",
      projectNaam: project?.naam ?? null,
      projectStatus: project?.status ?? null,
      garantieStatus: garantie?.status ?? null,
      garantieEindDatum: garantie?.eindDatum ?? null,
      eigenaarNaam: eigenaar?.name ?? null,
      werkitemNaam: werkitem?.naam ?? null,
      werkitemStatus: werkitem?.status ?? null,
      geescaleerd: isGeescaleerd(melding),
      afspraken: enrichedAfspraken,
    };
  },
});

/**
 * Get meldingen for a specific klant.
 */
export const getByKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const meldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    return meldingen.filter(
      (m) => !m.deletedAt && m.userId.toString() === companyUserId.toString()
    );
  },
});

/**
 * Get meldingen for a specific project.
 */
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const meldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return meldingen.filter(
      (m) => !m.deletedAt && m.userId.toString() === companyUserId.toString()
    );
  },
});

/**
 * Get meldingen grouped by status for kanban board.
 */
export const getKanbanData = query({
  args: {
    klantId: v.optional(v.id("klanten")),
    prioriteit: v.optional(prioriteitValidator),
    isGarantie: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const allMeldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .collect();

    let filtered = allMeldingen.filter(
      (m) => !m.deletedAt && m.userId.toString() === companyUserId.toString()
    );

    // Apply filters
    if (args.klantId) {
      filtered = filtered.filter(
        (m) => m.klantId.toString() === args.klantId!.toString()
      );
    }
    if (args.prioriteit) {
      filtered = filtered.filter((m) => m.prioriteit === args.prioriteit);
    }
    if (args.isGarantie !== undefined) {
      filtered = filtered.filter((m) => m.isGarantie === args.isGarantie);
    }

    // Enrich with klant names
    const enriched = await Promise.all(
      filtered.map(async (m) => {
        const klant = await ctx.db.get(m.klantId);
        return {
          ...m,
          klantNaam: klant?.naam ?? "Onbekend",
        };
      })
    );

    // Group by status
    const kanban = {
      nieuw: enriched.filter((m) => m.status === "nieuw"),
      in_behandeling: enriched.filter((m) => m.status === "in_behandeling"),
      ingepland: enriched.filter((m) => m.status === "ingepland"),
      afgehandeld: enriched.filter((m) => m.status === "afgehandeld"),
    };

    return kanban;
  },
});

/**
 * Het §2.4-bord: meldingen gegroepeerd in de vier PRD-statuskolommen
 * (legacy-statussen gemapt), met filter "mijn cases" (eigenaar = ik) en
 * escalatie-markering voor plantaken. Stafrollen lezen; klant → AuthError.
 */
export const getBord = query({
  args: {
    mijnCases: v.optional(v.boolean()),
    taaksoort: v.optional(
      v.union(
        v.literal("melding"),
        v.literal("plantaak"),
        v.literal("debiteurentaak")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const alle = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .collect();

    let relevant = alle.filter(
      (m) => !m.deletedAt && m.userId.toString() === companyUserId.toString()
    );
    if (args.mijnCases) {
      relevant = relevant.filter(
        (m) => m.eigenaarId?.toString() === user._id.toString()
      );
    }
    if (args.taaksoort) {
      relevant = relevant.filter(
        (m) => (m.taaksoort ?? "melding") === args.taaksoort
      );
    }

    // Verrijking met memoisatie — geen N+1 op dezelfde klant/eigenaar
    const klantCache = new Map<string, string>();
    const userCache = new Map<string, string>();
    const now = Date.now();
    const verrijkt = [];
    for (const m of relevant) {
      const klantKey = m.klantId.toString();
      if (!klantCache.has(klantKey)) {
        const klant = await ctx.db.get(m.klantId);
        klantCache.set(klantKey, klant?.naam ?? "Onbekend");
      }
      let eigenaarNaam: string | null = null;
      if (m.eigenaarId) {
        const key = m.eigenaarId.toString();
        if (!userCache.has(key)) {
          const eigenaar = await ctx.db.get(m.eigenaarId);
          userCache.set(key, eigenaar?.name ?? "Onbekend");
        }
        eigenaarNaam = userCache.get(key) ?? null;
      }
      verrijkt.push({
        ...m,
        klantNaam: klantCache.get(klantKey) ?? "Onbekend",
        eigenaarNaam,
        kolom: bordKolomVoorStatus(m.status),
        geescaleerd: isGeescaleerd(m, now),
      });
    }

    verrijkt.sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      nieuw: verrijkt.filter((m) => m.kolom === "nieuw"),
      in_behandeling: verrijkt.filter((m) => m.kolom === "in_behandeling"),
      wacht_op_derden: verrijkt.filter((m) => m.kolom === "wacht_op_derden"),
      opgelost: verrijkt.filter((m) => m.kolom === "opgelost"),
    };
  },
});

/**
 * Teller-badge in het menu (PRD §2.4): aantal open meldingen (alles wat
 * niet in de kolom "opgelost" staat). Klant-rol → AuthError.
 */
export const telOpenMeldingen = query({
  args: {},
  handler: async (ctx) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);
    const alle = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .collect();
    return alle.filter(
      (m) =>
        !m.deletedAt &&
        m.userId.toString() === companyUserId.toString() &&
        isOpenMelding(m.status)
    ).length;
  },
});

/**
 * Kandidaten voor de eigenaar-kiezer: interne gebruikers (geen klant-rol),
 * met kantoor-vlag zodat de UI bij klacht/schade alleen kantoor toont.
 */
export const listEigenaarKandidaten = query({
  args: {},
  handler: async (ctx) => {
    await requireInterneRol(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => normalizeRole(u.role) !== "klant")
      .map((u) => ({
        _id: u._id,
        naam: u.name,
        isKantoor: isKantoorRol(u.role),
      }))
      .sort((a, b) => a.naam.localeCompare(b.naam));
  },
});

// ============================================
// MUTATIONS
// ============================================

/** Weergavelabels voor tijdlijn-/threadteksten. */
const TYPE_LABEL: Record<MeldingType, string> = {
  serviceverzoek: "Serviceverzoek",
  klacht: "Klacht",
  schade: "Schademelding",
};

const STATUS_LABEL: Record<MeldingStatus, string> = {
  nieuw: "Nieuw",
  in_behandeling: "In behandeling",
  wacht_op_derden: "Wacht op derden",
  opgelost: "Opgelost",
  ingepland: "Ingepland",
  afgehandeld: "Afgehandeld",
};

/**
 * Nieuwe melding aanmaken (kantoor-only, PRD §2.4) met routing-defaults:
 * klacht → eigenaar kantoor; serviceverzoek → beoordelen voor de
 * planning-wachtrij; schade → kantoor + verzekeringsvlag. Eigenaar is
 * precies één en verplicht (default: de aanmaker). Logt automatisch op de
 * klanttijdlijn en als systeem-entry in de case-thread.
 * Auto-detects if the related project has an active garantie.
 */
export const create = mutation({
  args: {
    klantId: v.id("klanten"),
    projectId: v.optional(v.id("projecten")),
    beschrijving: v.string(),
    prioriteit: prioriteitValidator,
    fotos: v.optional(v.array(v.string())),
    contactInfo: v.optional(v.string()),
    kosten: v.optional(v.number()),
    // §2.4-velden (optioneel voor bestaande aanroepen; defaults in code)
    type: v.optional(meldingTypeValidator),
    kanaal: v.optional(meldingKanaalValidator),
    eigenaarId: v.optional(v.id("users")),
    deadline: v.optional(v.string()),
    werkitemId: v.optional(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);
    const companyUserId = await getCompanyUserId(ctx);
    const now = Date.now();

    const klant = await ctx.db.get(args.klantId);
    if (!klant || klant.userId.toString() !== companyUserId.toString()) {
      throw new ConvexError("Klant niet gevonden");
    }
    if (!args.beschrijving.trim()) {
      throw new ConvexError("Omschrijving is verplicht");
    }

    // Routing-defaults per type (PRD §2.4)
    const type: MeldingType = args.type ?? "serviceverzoek";
    const routing = routingDefaultsVoorType(type);

    // Eigenaar: precies één, verplicht — default de aanmakende kantoor-user
    const eigenaarId = args.eigenaarId ?? user._id;
    const eigenaar = await valideerEigenaar(
      ctx,
      eigenaarId,
      routing.eigenaarMoetKantoorZijn
    );

    // Gekoppeld werkitem ("klacht over de voorjaarsbeurt") valideren
    if (args.werkitemId) {
      const werkitem = await ctx.db.get(args.werkitemId);
      if (!werkitem || werkitem.userId.toString() !== companyUserId.toString()) {
        throw new ConvexError("Werkitem niet gevonden");
      }
    }

    // Auto-detect garantie if a project is provided
    let detectedGarantieId: Id<"garanties"> | undefined = undefined;
    let isGarantie = false;

    if (args.projectId) {
      const garantie = await ctx.db
        .query("garanties")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId!))
        .first();

      if (garantie && garantie.status === "actief" && !garantie.deletedAt) {
        const todayStr = new Date().toISOString().split("T")[0];
        if (garantie.eindDatum >= todayStr) {
          detectedGarantieId = garantie._id;
          isGarantie = true;
        }
      }
    }

    const id = await ctx.db.insert("servicemeldingen", {
      userId: companyUserId,
      klantId: args.klantId,
      projectId: args.projectId,
      garantieId: detectedGarantieId,
      beschrijving: args.beschrijving,
      isGarantie,
      status: "nieuw",
      prioriteit: args.prioriteit,
      fotos: args.fotos,
      contactInfo: args.contactInfo,
      kosten: isGarantie ? 0 : (args.kosten ?? 0),
      type,
      kanaal: args.kanaal ?? "intern",
      eigenaarId,
      aangemaaktDoorId: user._id,
      deadline: args.deadline,
      werkitemId: args.werkitemId,
      beoordelenVoorPlanning: routing.beoordelenVoorPlanning || undefined,
      verzekeringsvlag: routing.verzekeringsvlag || undefined,
      taaksoort: "melding",
      createdAt: now,
      updatedAt: now,
    });

    // Automatische logging (PRD §2.4): klanttijdlijn + interne case-thread
    await logTijdlijnEvent(ctx, {
      userId: companyUserId,
      klantId: args.klantId,
      eventType: "melding_aangemaakt",
      tekst: `${TYPE_LABEL[type]} aangemaakt: ${args.beschrijving.trim().slice(0, 120)} (eigenaar: ${eigenaar.name})`,
      werkitemId: args.werkitemId,
      meldingId: id,
    });
    await voegSysteemCommentToe(ctx, {
      userId: companyUserId,
      meldingId: id,
      tekst: `Melding aangemaakt door ${user.name} (${TYPE_LABEL[type].toLowerCase()}, eigenaar: ${eigenaar.name})`,
    });

    return id;
  },
});

/**
 * Statuswissel (kanban-drag / workflow, kantoor-only). Elke statuswissel
 * logt automatisch op de klanttijdlijn én in de interne case-thread.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("servicemeldingen"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const melding = await ctx.db.get(args.id);
    if (!melding || melding.userId.toString() !== companyUserId.toString()) {
      throw new ConvexError("Melding niet gevonden");
    }
    if (melding.status === args.status) return args.id;

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    await logTijdlijnEvent(ctx, {
      userId: companyUserId,
      klantId: melding.klantId,
      eventType: "melding_status_gewijzigd",
      tekst: `Melding "${melding.beschrijving.trim().slice(0, 80)}": status ${STATUS_LABEL[melding.status]} → ${STATUS_LABEL[args.status]}`,
      werkitemId: melding.werkitemId,
      meldingId: args.id,
    });
    await voegSysteemCommentToe(ctx, {
      userId: companyUserId,
      meldingId: args.id,
      tekst: `Status gewijzigd door ${user.name}: ${STATUS_LABEL[melding.status]} → ${STATUS_LABEL[args.status]}`,
    });

    return args.id;
  },
});

/**
 * Eigenaar wisselen (precies één, verplicht — kantoor-only).
 */
export const wijzigEigenaar = mutation({
  args: {
    id: v.id("servicemeldingen"),
    eigenaarId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const melding = await ctx.db.get(args.id);
    if (!melding || melding.userId.toString() !== companyUserId.toString()) {
      throw new ConvexError("Melding niet gevonden");
    }
    const routing = melding.type
      ? routingDefaultsVoorType(melding.type)
      : { eigenaarMoetKantoorZijn: false };
    const eigenaar = await valideerEigenaar(
      ctx,
      args.eigenaarId,
      routing.eigenaarMoetKantoorZijn
    );

    await ctx.db.patch(args.id, {
      eigenaarId: args.eigenaarId,
      updatedAt: Date.now(),
    });
    await voegSysteemCommentToe(ctx, {
      userId: companyUserId,
      meldingId: args.id,
      tekst: `Eigenaar gewijzigd door ${user.name} naar ${eigenaar.name}`,
    });
    return args.id;
  },
});

/**
 * Promotie melding → werkitem (PRD §2.4, bv. klacht → herstelbeurt):
 * maakt een ONGEPLAND werkitem (type onderhoudsbeurt, status "gepland",
 * geen geplandeStart → planbord-wachtrij) mét behoud van de koppeling in
 * beide richtingen (melding.werkitemId ↔ werkitem.meldingId).
 */
export const promoveerNaarWerkitem = mutation({
  args: {
    id: v.id("servicemeldingen"),
    naam: v.optional(v.string()),
    geschatteUren: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const melding = await ctx.db.get(args.id);
    if (!melding || melding.deletedAt || melding.userId.toString() !== companyUserId.toString()) {
      throw new ConvexError("Melding niet gevonden");
    }
    const klant = await ctx.db.get(melding.klantId);
    if (!klant) throw new ConvexError("Klant niet gevonden");

    const naam =
      args.naam?.trim() ||
      `Herstelbeurt: ${melding.beschrijving.trim().slice(0, 60)}`;

    const now = Date.now();
    const werkitemId = await ctx.db.insert("projecten", {
      userId: companyUserId,
      type: "onderhoudsbeurt",
      klantId: melding.klantId,
      naam,
      status: "gepland",
      // Ongepland: geen geplandeStart/teamId — landt in de wachtrij (§2.2)
      bouwsteenRegels: [{ omschrijving: naam }],
      geschatteUren: args.geschatteUren,
      adres: `${klant.adres}, ${klant.plaats}`,
      meldingId: args.id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.id, {
      werkitemId,
      status:
        melding.status === "nieuw" ? "in_behandeling" : melding.status,
      updatedAt: now,
    });

    await logTijdlijnEvent(ctx, {
      userId: companyUserId,
      klantId: melding.klantId,
      eventType: "melding_status_gewijzigd",
      tekst: `Melding gepromoveerd tot werkitem "${naam}" (wachtrij)`,
      werkitemId,
      meldingId: args.id,
    });
    await voegSysteemCommentToe(ctx, {
      userId: companyUserId,
      meldingId: args.id,
      tekst: `${user.name} maakte werkitem "${naam}" uit deze melding (in de wachtrij)`,
    });

    return werkitemId;
  },
});

/**
 * Update melding details.
 */
export const update = mutation({
  args: {
    id: v.id("servicemeldingen"),
    beschrijving: v.optional(v.string()),
    prioriteit: v.optional(prioriteitValidator),
    isGarantie: v.optional(v.boolean()),
    kosten: v.optional(v.number()),
    contactInfo: v.optional(v.string()),
    fotos: v.optional(v.array(v.string())),
    deadline: v.optional(v.string()),
    kanaal: v.optional(meldingKanaalValidator),
    escalatieDagen: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);

    const melding = await ctx.db.get(args.id);
    await verifyOwnership(ctx, melding, "servicemelding");

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.beschrijving !== undefined) updates.beschrijving = args.beschrijving;
    if (args.prioriteit !== undefined) updates.prioriteit = args.prioriteit;
    if (args.isGarantie !== undefined) {
      updates.isGarantie = args.isGarantie;
      if (args.isGarantie) updates.kosten = 0;
    }
    if (args.kosten !== undefined) updates.kosten = args.kosten;
    if (args.contactInfo !== undefined) updates.contactInfo = args.contactInfo;
    if (args.fotos !== undefined) updates.fotos = args.fotos;
    if (args.deadline !== undefined) updates.deadline = args.deadline;
    if (args.kanaal !== undefined) updates.kanaal = args.kanaal;
    if (args.escalatieDagen !== undefined) {
      if (args.escalatieDagen < 1 || !Number.isInteger(args.escalatieDagen)) {
        throw new ConvexError("Escalatie: dagen moet 1 of hoger zijn");
      }
      updates.escalatieDagen = args.escalatieDagen;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Add a service appointment to a melding.
 */
export const addAfspraak = mutation({
  args: {
    meldingId: v.id("servicemeldingen"),
    datum: v.string(),
    medewerkerIds: v.array(v.id("medewerkers")),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);
    const userId = user._id;

    const melding = await ctx.db.get(args.meldingId);
    await verifyOwnership(ctx, melding, "servicemelding");

    const now = Date.now();

    const afspraakId = await ctx.db.insert("serviceAfspraken", {
      meldingId: args.meldingId,
      userId,
      datum: args.datum,
      medewerkerIds: args.medewerkerIds,
      notities: args.notities,
      status: "gepland",
      createdAt: now,
      updatedAt: now,
    });

    // Update melding status to "ingepland"
    await ctx.db.patch(args.meldingId, {
      status: "ingepland",
      updatedAt: now,
    });

    return afspraakId;
  },
});

/**
 * Update an existing service appointment.
 */
export const updateAfspraak = mutation({
  args: {
    afspraakId: v.id("serviceAfspraken"),
    datum: v.optional(v.string()),
    medewerkerIds: v.optional(v.array(v.id("medewerkers"))),
    notities: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("gepland"),
        v.literal("uitgevoerd"),
        v.literal("geannuleerd")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);

    const afspraak = await ctx.db.get(args.afspraakId);
    if (!afspraak) {
      throw new ConvexError("Afspraak niet gevonden");
    }

    await verifyOwnership(ctx, afspraak, "serviceafspraak");

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.datum !== undefined) updates.datum = args.datum;
    if (args.medewerkerIds !== undefined) updates.medewerkerIds = args.medewerkerIds;
    if (args.notities !== undefined) updates.notities = args.notities;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.afspraakId, updates);

    // If afspraak is marked as uitgevoerd, update melding to afgehandeld
    if (args.status === "uitgevoerd") {
      await ctx.db.patch(afspraak.meldingId, {
        status: "afgehandeld",
        updatedAt: Date.now(),
      });
    }

    return args.afspraakId;
  },
});
