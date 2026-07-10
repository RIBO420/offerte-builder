/**
 * Klanttijdlijn (PRD §2.3) — per klant één doorzoekbaar, intern kantoordossier.
 *
 * Beantwoordt de Pietje-test (PRD §8.1): "wie heeft wat met klant X besproken,
 * wanneer, via welk kanaal, over welke klus?" binnen 30 seconden.
 *
 * ── Toegangsmodel (PRD §1.2, hard) ────────────────────────────────────────
 * De tijdlijn is een INTERN KANTOORDOSSIER:
 * - De klant-rol heeft GEEN ENKELE query of mutation op deze tabel. Elke
 *   functie in dit bestand begint met requireInterneRol of requireKantoor,
 *   die voor klant-accounts een AuthError gooien. Klantcommunicatie via het
 *   portaal is een apart kanaal (chat_threads) en blijft dat.
 * - Lezen: alle interne rollen (kantoor/voorman/medewerker) binnen het
 *   eigen bedrijf. Schrijven (handmatige entries): alleen kantoor.
 * - klantTijdlijn is een EIGEN tabel, gescheiden van de interne chat
 *   (team_messages/direct_messages) én van de klant-threads — een
 *   query-fout kan dus nooit interne communicatie naar de klant lekken.
 *
 * ── Auto-events ───────────────────────────────────────────────────────────
 * logTijdlijnEvent is de ENIGE ingang voor systeem-events en wordt
 * aangeroepen vanuit bestaande mutations (offertes, werkitems, contracten,
 * portaal, leads). De helper is bewust niet-blokkerend: een fout in de
 * tijdlijn-logging mag de bestaande flow (offerte versturen, inplannen …)
 * nooit breken.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { AuthError, requireAuth } from "./auth";
import { getCompanyUserId, normalizeRole, requireKantoor } from "./roles";
import {
  tijdlijnHandmatigKanaalValidator,
  tijdlijnKanaalValidator,
} from "./validators";

// ============================================
// Types
// ============================================

export type TijdlijnKanaal = Doc<"klantTijdlijn">["kanaal"];
export type TijdlijnEventType = Doc<"klantTijdlijn">["eventType"];
export type TijdlijnEntry = Doc<"klantTijdlijn">;

const DEFAULT_LIMIT = 200;
const ZOEK_LIMIT = 50;

// ============================================
// Toegang (PRD §1.2)
// ============================================

/**
 * Vereis een interne rol: elke rol behalve `klant`.
 * De klanttijdlijn is een intern kantoordossier — de klant-rol krijgt op
 * ELKE tijdlijn-functie een AuthError, nooit een lege lijst (fail-loud).
 */
export async function requireInterneRol(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (normalizeRole(user.role) === "klant") {
    throw new AuthError(
      "De klanttijdlijn is een intern kantoordossier en is niet beschikbaar voor klantaccounts"
    );
  }
  return user;
}

/** Klant ophalen + bedrijfsscope afdwingen (multi-tenant). */
async function getKlantBinnenBedrijf(
  ctx: QueryCtx | MutationCtx,
  klantId: Id<"klanten">
): Promise<{ klant: Doc<"klanten">; companyUserId: Id<"users"> }> {
  const companyUserId = await getCompanyUserId(ctx);
  const klant = await ctx.db.get(klantId);
  if (!klant || klant.userId.toString() !== companyUserId.toString()) {
    throw new ConvexError("Klant niet gevonden");
  }
  return { klant, companyUserId };
}

// ============================================
// Centrale helper voor auto-events
// ============================================

export type LogTijdlijnEventArgs = {
  /** Bedrijfseigenaar (multi-tenant scope) — meestal <record>.userId */
  userId: Id<"users">;
  klantId: Id<"klanten">;
  eventType: TijdlijnEventType;
  /** Mensleesbare samenvatting, bv. "Offerte OFF-2026-014 verzonden" */
  tekst: string;
  /** Default "systeem" — handmatige kanalen lopen via voegEntryToe */
  kanaal?: TijdlijnKanaal;
  /** undefined = systeem-event */
  auteurId?: Id<"users">;
  auteurNaam?: string;
  werkitemId?: Id<"projecten">;
  /** §2.4: koppeling met de melding/case op het interne bord */
  meldingId?: Id<"servicemeldingen">;
  bijlagen?: Id<"_storage">[];
  /** Default Date.now() — migratie/backdated events kunnen afwijken */
  timestamp?: number;
};

/**
 * Centrale, additieve logging van een tijdlijn-event (kanaal "systeem").
 *
 * NIET-BLOKKEREND: een fout hier mag de aanroepende mutation (offerte
 * versturen, werkitem inplannen, contract opzeggen …) nooit laten falen.
 * Bij een fout wordt zonder PII gelogd en null teruggegeven.
 */
export async function logTijdlijnEvent(
  ctx: MutationCtx,
  args: LogTijdlijnEventArgs
): Promise<Id<"klantTijdlijn"> | null> {
  try {
    const now = Date.now();
    return await ctx.db.insert("klantTijdlijn", {
      userId: args.userId,
      klantId: args.klantId,
      timestamp: args.timestamp ?? now,
      auteurId: args.auteurId,
      auteurNaam: args.auteurNaam ?? "Systeem",
      kanaal: args.kanaal ?? "systeem",
      eventType: args.eventType,
      tekst: args.tekst,
      werkitemId: args.werkitemId,
      meldingId: args.meldingId,
      bijlagen: args.bijlagen,
      createdAt: now,
    });
  } catch (error) {
    // Geen PII in logs: alleen het event-type en de foutklasse
    console.error(
      `[tijdlijn] logTijdlijnEvent mislukt (eventType=${args.eventType}):`,
      error instanceof Error ? error.name : "onbekende fout"
    );
    return null;
  }
}

// ============================================
// Verrijking (werkitem-naam voor weergave)
// ============================================

type VerrijkteEntry = TijdlijnEntry & { werkitemNaam?: string };

async function verrijkMetWerkitemNaam(
  ctx: QueryCtx,
  entries: TijdlijnEntry[]
): Promise<VerrijkteEntry[]> {
  const namen = new Map<string, string>();
  const result: VerrijkteEntry[] = [];
  for (const entry of entries) {
    if (!entry.werkitemId) {
      result.push(entry);
      continue;
    }
    const key = entry.werkitemId.toString();
    if (!namen.has(key)) {
      const werkitem = await ctx.db.get(entry.werkitemId);
      namen.set(key, werkitem?.naam ?? "Onbekend werkitem");
    }
    result.push({ ...entry, werkitemNaam: namen.get(key) });
  }
  return result;
}

/**
 * Expliciete na-filtering bovenop de indexquery (belt & braces):
 * de tenancy- en klant-scope mag nooit alleen van de gekozen index afhangen.
 */
function filterEntries(
  entries: TijdlijnEntry[],
  scope: {
    companyUserId: Id<"users">;
    klantId?: Id<"klanten">;
    kanaal?: TijdlijnKanaal;
    werkitemId?: Id<"projecten">;
  }
): TijdlijnEntry[] {
  return entries.filter((e) => {
    if (e.userId.toString() !== scope.companyUserId.toString()) return false;
    if (scope.klantId && e.klantId.toString() !== scope.klantId.toString()) {
      return false;
    }
    if (scope.kanaal && e.kanaal !== scope.kanaal) return false;
    if (
      scope.werkitemId &&
      e.werkitemId?.toString() !== scope.werkitemId.toString()
    ) {
      return false;
    }
    return true;
  });
}

const sorteerNieuwsteBoven = (a: TijdlijnEntry, b: TijdlijnEntry) =>
  b.timestamp - a.timestamp;

// ============================================
// Queries (intern; klant-rol → AuthError)
// ============================================

/**
 * Tijdlijn van één klant, nieuwste boven, met filters op kanaal en werkitem.
 */
export const listVoorKlant = query({
  args: {
    klantId: v.id("klanten"),
    kanaal: v.optional(tijdlijnKanaalValidator),
    werkitemId: v.optional(v.id("projecten")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const { companyUserId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const entries = await ctx.db
      .query("klantTijdlijn")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .order("desc")
      .collect();

    const gefilterd = filterEntries(entries, {
      companyUserId,
      klantId: args.klantId,
      kanaal: args.kanaal,
      werkitemId: args.werkitemId,
    })
      .sort(sorteerNieuwsteBoven)
      .slice(0, args.limit ?? DEFAULT_LIMIT);

    return verrijkMetWerkitemNaam(ctx, gefilterd);
  },
});

/**
 * Tijdlijn gefilterd op één werkitem (Projecten-tab in de Chat-module):
 * zelfde data als listVoorKlant, andere ingang — géén tweede opslag.
 */
export const listVoorWerkitem = query({
  args: {
    werkitemId: v.id("projecten"),
    kanaal: v.optional(tijdlijnKanaalValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const werkitem = await ctx.db.get(args.werkitemId);
    if (!werkitem || werkitem.userId.toString() !== companyUserId.toString()) {
      throw new ConvexError("Werkitem niet gevonden");
    }

    const entries = await ctx.db
      .query("klantTijdlijn")
      .withIndex("by_werkitem", (q) => q.eq("werkitemId", args.werkitemId))
      .order("desc")
      .collect();

    const gefilterd = filterEntries(entries, {
      companyUserId,
      kanaal: args.kanaal,
      werkitemId: args.werkitemId,
    })
      .sort(sorteerNieuwsteBoven)
      .slice(0, args.limit ?? DEFAULT_LIMIT);

    return verrijkMetWerkitemNaam(ctx, gefilterd);
  },
});

/**
 * Vrij zoeken in de tijdlijn (Convex search-index op tekst).
 * Optioneel binnen één klant, kanaal en/of werkitem.
 */
export const zoek = query({
  args: {
    zoekterm: v.string(),
    klantId: v.optional(v.id("klanten")),
    kanaal: v.optional(tijdlijnKanaalValidator),
    werkitemId: v.optional(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const zoekterm = args.zoekterm.trim();
    if (!zoekterm) return [];

    const resultaten = await ctx.db
      .query("klantTijdlijn")
      .withSearchIndex("search_tekst", (q) => {
        let s = q.search("tekst", zoekterm).eq("userId", companyUserId);
        if (args.klantId) s = s.eq("klantId", args.klantId);
        if (args.kanaal) s = s.eq("kanaal", args.kanaal);
        if (args.werkitemId) s = s.eq("werkitemId", args.werkitemId);
        return s;
      })
      .take(ZOEK_LIMIT);

    const gefilterd = filterEntries(resultaten, {
      companyUserId,
      klantId: args.klantId,
      kanaal: args.kanaal,
      werkitemId: args.werkitemId,
    });

    return verrijkMetWerkitemNaam(ctx, gefilterd);
  },
});

/**
 * Klanten-tab in de Chat-module: klanten van het bedrijf gesorteerd op
 * laatste tijdlijn-activiteit, met een preview van de laatste entry.
 */
export const listKlantenMetTijdlijn = query({
  args: {},
  handler: async (ctx) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .collect();

    const actieveKlanten = klanten.filter(
      (k) =>
        k.userId.toString() === companyUserId.toString() &&
        k.isArchived !== true
    );

    const result = [];
    for (const klant of actieveKlanten) {
      const laatste = await ctx.db
        .query("klantTijdlijn")
        .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
        .order("desc")
        .first();
      const entryOk =
        laatste &&
        laatste.klantId.toString() === klant._id.toString() &&
        laatste.userId.toString() === companyUserId.toString();
      result.push({
        klantId: klant._id,
        naam: klant.naam,
        plaats: klant.plaats,
        laatsteEntryAt: entryOk ? laatste.timestamp : undefined,
        laatsteEntryPreview: entryOk
          ? laatste.tekst.length > 80
            ? `${laatste.tekst.substring(0, 80)}...`
            : laatste.tekst
          : undefined,
        laatsteEntryKanaal: entryOk ? laatste.kanaal : undefined,
      });
    }

    return result.sort(
      (a, b) => (b.laatsteEntryAt ?? 0) - (a.laatsteEntryAt ?? 0)
    );
  },
});

/**
 * Projecten-tab in de Chat-module: werkitems mét tijdlijn-entries,
 * gesorteerd op laatste activiteit.
 */
export const listWerkitemsMetTijdlijn = query({
  args: {},
  handler: async (ctx) => {
    await requireInterneRol(ctx);
    const companyUserId = await getCompanyUserId(ctx);

    const entries = await ctx.db
      .query("klantTijdlijn")
      .withIndex("by_user", (q) => q.eq("userId", companyUserId))
      .order("desc")
      .collect();

    const perWerkitem = new Map<string, TijdlijnEntry>();
    for (const entry of filterEntries(entries, { companyUserId })) {
      if (!entry.werkitemId) continue;
      const key = entry.werkitemId.toString();
      const huidige = perWerkitem.get(key);
      if (!huidige || entry.timestamp > huidige.timestamp) {
        perWerkitem.set(key, entry);
      }
    }

    const result = [];
    for (const entry of perWerkitem.values()) {
      if (!entry.werkitemId) continue;
      const werkitem = await ctx.db.get(entry.werkitemId);
      if (!werkitem || werkitem.userId.toString() !== companyUserId.toString()) {
        continue;
      }
      const klant = entry.klantId ? await ctx.db.get(entry.klantId) : null;
      result.push({
        werkitemId: entry.werkitemId,
        werkitemNaam: werkitem.naam,
        klantId: entry.klantId,
        klantNaam: klant?.naam ?? "Onbekende klant",
        laatsteEntryAt: entry.timestamp,
        laatsteEntryPreview:
          entry.tekst.length > 80
            ? `${entry.tekst.substring(0, 80)}...`
            : entry.tekst,
      });
    }

    return result.sort((a, b) => b.laatsteEntryAt - a.laatsteEntryAt);
  },
});

/**
 * Werkitems van een klant voor de filter-dropdown op de tijdlijn.
 */
export const listWerkitemsVoorFilter = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const { companyUserId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const werkitems = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    return werkitems
      .filter(
        (w) =>
          w.userId.toString() === companyUserId.toString() &&
          w.klantId?.toString() === args.klantId.toString() &&
          !w.deletedAt
      )
      .map((w) => ({ _id: w._id, naam: w.naam, type: w.type ?? "project" }));
  },
});

/**
 * Read-only historie: bestaande klant-thread-berichten (chat_threads) van
 * vóór de tijdlijn-ombouw. BESLUIT (§2.3, gedocumenteerd): deze berichten
 * worden NIET gemigreerd naar de tijdlijn maar als read-only historie-blok
 * onder de tijdlijn getoond — geen dataverlies, geen dubbele opslag, en het
 * portaal (dat op chat_threads leunt) blijft ongewijzigd werken.
 * Intern-only: klant-rol krijgt ook hier een AuthError.
 */
export const chatHistorieVoorKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const { companyUserId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const threads = await ctx.db
      .query("chat_threads")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    const klantThreads = threads.filter(
      (t) =>
        t.type === "klant" &&
        t.klantId?.toString() === args.klantId.toString() &&
        t.companyUserId.toString() === companyUserId.toString()
    );

    const berichten = [];
    for (const thread of klantThreads) {
      const messages = await ctx.db
        .query("chat_messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      for (const msg of messages) {
        berichten.push({
          _id: msg._id,
          senderType: msg.senderType,
          senderName: msg.senderName,
          message: msg.message,
          createdAt: msg.createdAt,
        });
      }
    }

    return berichten.sort((a, b) => a.createdAt - b.createdAt);
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Handmatige tijdlijn-entry (kantoor-only, PRD §2.3): telefoonnotitie,
 * geplakte/samengevatte WhatsApp (fase 1 handmatig met kanaal-tag),
 * e-mailsamenvatting of interne notitie. Optioneel gekoppeld aan een
 * werkitem en met foto's (fotoStorage-patroon).
 */
export const voegEntryToe = mutation({
  args: {
    klantId: v.id("klanten"),
    kanaal: tijdlijnHandmatigKanaalValidator,
    tekst: v.string(),
    werkitemId: v.optional(v.id("projecten")),
    bijlagen: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    // Schrijven op de tijdlijn is een kantoor-taak (PRD §1.2/§2.3);
    // requireKantoor weigert klant, voorman en medewerker met AuthError.
    const user = await requireKantoor(ctx);
    const { companyUserId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const tekst = args.tekst.trim();
    if (!tekst) {
      throw new ConvexError("Tekst is verplicht voor een tijdlijn-entry");
    }

    if (args.werkitemId) {
      const werkitem = await ctx.db.get(args.werkitemId);
      if (
        !werkitem ||
        werkitem.userId.toString() !== companyUserId.toString()
      ) {
        throw new ConvexError("Werkitem niet gevonden");
      }
      if (werkitem.klantId?.toString() !== args.klantId.toString()) {
        throw new ConvexError("Werkitem hoort niet bij deze klant");
      }
    }

    const now = Date.now();
    return await ctx.db.insert("klantTijdlijn", {
      userId: companyUserId,
      klantId: args.klantId,
      timestamp: now,
      auteurId: user._id,
      auteurNaam: user.name,
      kanaal: args.kanaal,
      eventType: "handmatig",
      tekst,
      werkitemId: args.werkitemId,
      bijlagen: args.bijlagen,
      createdAt: now,
    });
  },
});
