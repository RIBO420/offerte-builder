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
import { AuthError, requireAuth, requireOrgId } from "./auth";
import { normalizeRole, requireKantoor } from "./roles";
import {
  tijdlijnHandmatigKanaalValidator,
  tijdlijnKanaalValidator,
} from "./validators";
import { laadDocsMap } from "./lib/batchLoad";

// ============================================
// Types
// ============================================

export type TijdlijnKanaal = Doc<"klantTijdlijn">["kanaal"];
export type TijdlijnEventType = Doc<"klantTijdlijn">["eventType"];
export type TijdlijnEntry = Doc<"klantTijdlijn">;

const DEFAULT_LIMIT = 200;
const ZOEK_LIMIT = 50;

/** Zelfde grenzen als klantTaken.create — taken uit een gesprek zijn taken. */
const GESPREK_MAX_TAAKTITEL = 200;
const GESPREK_DEADLINE_PATROON = /^\d{4}-\d{2}-\d{2}$/;

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

/** Klant ophalen + organisatiescope afdwingen (multi-tenant). */
async function getKlantBinnenBedrijf(
  ctx: QueryCtx | MutationCtx,
  klantId: Id<"klanten">
): Promise<{ klant: Doc<"klanten">; orgId: Id<"organisaties"> }> {
  const orgId = await requireOrgId(ctx);
  const klant = await ctx.db.get(klantId);
  // `orgId` is optioneel in het schema zolang de migratie loopt; een klant
  // zonder org hoort bij niemand en valt hier dus buiten de scope.
  if (!klant || klant.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Klant niet gevonden");
  }
  return { klant, orgId };
}

// ============================================
// Centrale helper voor auto-events
// ============================================

export type LogTijdlijnEventArgs = {
  /**
   * De organisatie waar deze entry bij hoort — DE tenant-scope sinds fase 3.
   * Optioneel voor aanroepers buiten dit cluster: laat je hem weg, dan wordt
   * hij afgeleid uit de klant zelf (een tijdlijn-entry hoort per definitie bij
   * de organisatie van de klant).
   */
  orgId?: Id<"organisaties">;
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
    // Zonder expliciete orgId de klant als bron nemen: die weet bij welke
    // organisatie het dossier hoort, en zo hoeven de twaalf aanroepers buiten
    // dit cluster hun eigen scope-resolver niet mee te sturen.
    const orgId = args.orgId ?? (await ctx.db.get(args.klantId))?.orgId;
    if (!orgId) {
      // Klant bestaat niet meer: zonder org-scope zou de entry dakloos zijn.
      console.error(
        `[tijdlijn] logTijdlijnEvent zonder org-scope (eventType=${args.eventType})`
      );
      return null;
    }
    return await ctx.db.insert("klantTijdlijn", {
      orgId,
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
  // N+1 weg (audit §5): de werkitems in één ronde ophalen. De oude memoisatie
  // voorkwam dubbele gets, maar liet ze wel strikt na elkaar lopen — bij een
  // tijdlijn met 50 verschillende werkitems zijn dat 50 seriële round-trips.
  const werkitemMap = await laadDocsMap(
    ctx,
    entries.map((e) => e.werkitemId)
  );

  return entries.map((entry) => {
    if (!entry.werkitemId) return entry;
    return {
      ...entry,
      werkitemNaam:
        werkitemMap.get(entry.werkitemId.toString())?.naam ??
        "Onbekend werkitem",
    };
  });
}

/**
 * Expliciete na-filtering bovenop de indexquery (belt & braces):
 * de tenancy- en klant-scope mag nooit alleen van de gekozen index afhangen.
 */
function filterEntries(
  entries: TijdlijnEntry[],
  scope: {
    orgId: Id<"organisaties">;
    klantId?: Id<"klanten">;
    kanaal?: TijdlijnKanaal;
    werkitemId?: Id<"projecten">;
  }
): TijdlijnEntry[] {
  return entries.filter((e) => {
    if (e.orgId?.toString() !== scope.orgId.toString()) return false;
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
    const { orgId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const entries = await ctx.db
      .query("klantTijdlijn")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .order("desc")
      .collect();

    const gefilterd = filterEntries(entries, {
      orgId,
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
    const orgId = await requireOrgId(ctx);

    const werkitem = await ctx.db.get(args.werkitemId);
    if (!werkitem || werkitem.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Werkitem niet gevonden");
    }

    const entries = await ctx.db
      .query("klantTijdlijn")
      .withIndex("by_werkitem", (q) => q.eq("werkitemId", args.werkitemId))
      .order("desc")
      .collect();

    const gefilterd = filterEntries(entries, {
      orgId,
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
    const orgId = await requireOrgId(ctx);

    const zoekterm = args.zoekterm.trim();
    if (!zoekterm) return [];

    const resultaten = await ctx.db
      .query("klantTijdlijn")
      .withSearchIndex("search_tekst", (q) => {
        let s = q.search("tekst", zoekterm).eq("orgId", orgId);
        if (args.klantId) s = s.eq("klantId", args.klantId);
        if (args.kanaal) s = s.eq("kanaal", args.kanaal);
        if (args.werkitemId) s = s.eq("werkitemId", args.werkitemId);
        return s;
      })
      .take(ZOEK_LIMIT);

    const gefilterd = filterEntries(resultaten, {
      orgId,
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
    const orgId = await requireOrgId(ctx);

    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const actieveKlanten = klanten.filter(
      (k) => k.orgId?.toString() === orgId.toString() && k.isArchived !== true
    );

    // N+1 weg (audit §5): de "laatste entry"-queries parallel afvuren in
    // plaats van serieel per klant. Elke query blijft geïndexeerd en leest
    // één rij, maar wacht niet meer op de klant ervoor.
    const laatsteEntries = await Promise.all(
      actieveKlanten.map((klant) =>
        ctx.db
          .query("klantTijdlijn")
          .withIndex("by_klant", (q) => q.eq("klantId", klant._id))
          .order("desc")
          .first()
      )
    );

    const result = [];
    for (const [i, klant] of actieveKlanten.entries()) {
      const laatste = laatsteEntries[i];
      const entryOk =
        laatste &&
        laatste.klantId.toString() === klant._id.toString() &&
        laatste.orgId?.toString() === orgId.toString();
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
    const orgId = await requireOrgId(ctx);

    const entries = await ctx.db
      .query("klantTijdlijn")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();

    const perWerkitem = new Map<string, TijdlijnEntry>();
    for (const entry of filterEntries(entries, { orgId })) {
      if (!entry.werkitemId) continue;
      const key = entry.werkitemId.toString();
      const huidige = perWerkitem.get(key);
      if (!huidige || entry.timestamp > huidige.timestamp) {
        perWerkitem.set(key, entry);
      }
    }

    // N+1 weg (audit §5): werkitems en klanten in twee rondes ophalen; veel
    // werkitems horen bij dezelfde klant.
    const laatsteEntries = [...perWerkitem.values()];
    const [werkitemMap, klantMap] = await Promise.all([
      laadDocsMap(
        ctx,
        laatsteEntries.map((e) => e.werkitemId)
      ),
      laadDocsMap(
        ctx,
        laatsteEntries.map((e) => e.klantId)
      ),
    ]);

    const result = [];
    for (const entry of laatsteEntries) {
      if (!entry.werkitemId) continue;
      const werkitem = werkitemMap.get(entry.werkitemId.toString());
      if (!werkitem || werkitem.orgId?.toString() !== orgId.toString()) {
        continue;
      }
      const klant = entry.klantId ? klantMap.get(entry.klantId.toString()) : null;
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
    const { orgId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const werkitems = await ctx.db
      .query("projecten")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    return werkitems
      .filter(
        (w) =>
          w.orgId?.toString() === orgId.toString() &&
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
    const { orgId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const threads = await ctx.db
      .query("chat_threads")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    const klantThreads = threads.filter(
      (t) =>
        t.type === "klant" &&
        t.klantId?.toString() === args.klantId.toString() &&
        t.orgId?.toString() === orgId.toString()
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
    const { orgId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const tekst = args.tekst.trim();
    if (!tekst) {
      throw new ConvexError("Tekst is verplicht voor een tijdlijn-entry");
    }

    if (args.werkitemId) {
      const werkitem = await ctx.db.get(args.werkitemId);
      if (!werkitem || werkitem.orgId?.toString() !== orgId.toString()) {
        throw new ConvexError("Werkitem niet gevonden");
      }
      if (werkitem.klantId?.toString() !== args.klantId.toString()) {
        throw new ConvexError("Werkitem hoort niet bij deze klant");
      }
    }

    const now = Date.now();
    return await ctx.db.insert("klantTijdlijn", {
      orgId,
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

/**
 * Gesprek vastleggen mét de taken die de gebruiker heeft aangevinkt
 * (klantdossier v7, WS4).
 *
 * Eén mutation, dus één transactie: de tijdlijn-entry en de taken staan er
 * samen in of geen van beide. De koppeling gaat twee kanten op —
 * `klantTaken.bronTijdlijnId` wijst naar de entry, `gekoppeldeTaakIds` op de
 * entry wijst terug — zodat zowel de tijdlijn ("3 taken aangemaakt uit dit
 * gesprek") als de taakregel ("uit gesprek") het verband kan tonen zonder
 * een extra query.
 *
 * De taken komen van de gebruiker, niet van de AI: `gesprekAnalyse.analyseer`
 * doet alleen vóórstellen. Wat hier binnenkomt is wat er is aangevinkt.
 */
export const legGesprekVast = mutation({
  args: {
    klantId: v.id("klanten"),
    kanaal: tijdlijnHandmatigKanaalValidator,
    tekst: v.string(),
    /**
     * Alleen de aangevinkte voorstellen. Leeg = "Alleen gesprek vastleggen".
     * Prioriteit en toewijzing blijven leeg: dat is werk voor de takenlijst,
     * niet voor een vinkje in een analysepaneel.
     */
    taken: v.array(
      v.object({
        titel: v.string(),
        deadline: v.optional(v.string()),
      })
    ),
    werkitemId: v.optional(v.id("projecten")),
    /**
     * Onderscheidt een afspraak van een gewone interne notitie; beide gaan
     * op kanaal "intern". Default "handmatig", zoals voegEntryToe.
     */
    eventType: v.optional(
      v.union(v.literal("handmatig"), v.literal("afspraak"))
    ),
    // ─── Opname (fase B, WS5) ───────────────────────────────────────────────
    /** Duur van de opname in seconden; toont als "OPNAME · m:ss" op de regel. */
    opnameDuurSec: v.optional(v.number()),
    /**
     * De geüploade audio. Wat hiermee gebeurt hangt aan `transcriptieStatus`
     * en is een harde productregel uit de klantbriefing:
     * - "gelukt"  → de tekst hieronder ís het gesprek; de audio wordt hier
     *   verwijderd (`ctx.storage.delete`) en het veld blijft leeg.
     * - "mislukt" → de audio blijft juist bewaard, zodat kantoor hem alsnog
     *   kan terugluisteren en het gesprek handmatig kan uitwerken.
     */
    audioId: v.optional(v.id("_storage")),
    transcriptieStatus: v.optional(
      v.union(v.literal("gelukt"), v.literal("mislukt"))
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ entryId: Id<"klantTijdlijn">; taakIds: Id<"klantTaken">[] }> => {
    // Zelfde slot als voegEntryToe: schrijven op de tijdlijn is kantoorwerk.
    const user = await requireKantoor(ctx);
    const { orgId } = await getKlantBinnenBedrijf(ctx, args.klantId);

    const tekst = args.tekst.trim();
    if (!tekst) {
      throw new ConvexError("Tekst is verplicht voor een tijdlijn-entry");
    }

    if (args.werkitemId) {
      const werkitem = await ctx.db.get(args.werkitemId);
      if (!werkitem || werkitem.orgId?.toString() !== orgId.toString()) {
        throw new ConvexError("Werkitem niet gevonden");
      }
      if (werkitem.klantId?.toString() !== args.klantId.toString()) {
        throw new ConvexError("Werkitem hoort niet bij deze klant");
      }
    }

    // Audio wordt verwijderd zodra de transcriptie is opgeslagen (harde
    // productregel: alleen de tekst blijft). Bij een MISLUKTE transcriptie
    // blijft hij juist staan, want dan is de audio het enige wat er nog van
    // het gesprek over is. De delete gebeurt bewust vóór de insert niet, maar
    // erna — zie onderaan: mislukt de insert, dan is de audio nog terug te
    // vinden in plaats van stilletjes weg.
    const bewaarAudio = args.transcriptieStatus === "mislukt";

    const now = Date.now();
    const entryId = await ctx.db.insert("klantTijdlijn", {
      orgId,
      klantId: args.klantId,
      timestamp: now,
      auteurId: user._id,
      auteurNaam: user.name,
      kanaal: args.kanaal,
      eventType: args.eventType ?? "handmatig",
      tekst,
      werkitemId: args.werkitemId,
      opnameDuurSec: args.opnameDuurSec,
      audioId: bewaarAudio ? args.audioId : undefined,
      transcriptieStatus: args.transcriptieStatus,
      createdAt: now,
    });

    if (args.audioId && !bewaarAudio) {
      // Geslaagde transcriptie: de tekst staat er nu in, de audio mag weg.
      // Een storage-object dat al opgeruimd is mag het vastleggen niet alsnog
      // laten mislukken — de entry is dan al geschreven.
      try {
        await ctx.storage.delete(args.audioId);
      } catch (fout) {
        console.warn("legGesprekVast: audio opruimen mislukt", fout);
      }
    }

    // Taken volgens het klantTaken.create-patroon, plus de herkomst.
    const taakIds: Id<"klantTaken">[] = [];
    for (const taak of args.taken) {
      const titel = taak.titel.trim();
      if (!titel) continue;
      if (titel.length > GESPREK_MAX_TAAKTITEL) {
        throw new ConvexError(
          `Titel mag maximaal ${GESPREK_MAX_TAAKTITEL} tekens zijn`
        );
      }
      const deadline = taak.deadline?.trim() || undefined;
      if (deadline && !GESPREK_DEADLINE_PATROON.test(deadline)) {
        throw new ConvexError("Deadline moet in het formaat JJJJ-MM-DD staan");
      }

      taakIds.push(
        await ctx.db.insert("klantTaken", {
          orgId,
          klantId: args.klantId,
          titel,
          status: "open",
          prioriteit: "normaal",
          deadline,
          werkitemId: args.werkitemId,
          bronTijdlijnId: entryId,
          aangemaaktDoorId: user._id,
          createdAt: now,
          updatedAt: now,
        })
      );
    }

    // Pas nu de tegenkoppeling: zonder taken blijft het veld leeg in plaats
    // van een lege array, zodat "heeft dit gesprek taken opgeleverd?" één
    // simpele check blijft.
    if (taakIds.length > 0) {
      await ctx.db.patch(entryId, { gekoppeldeTaakIds: taakIds });
    }

    return { entryId, taakIds };
  },
});

// ============================================
// Opname (klantdossier v7, WS5)
// ============================================

/**
 * Upload-URL voor een opgenomen gesprek — zelfde twee-staps-patroon als
 * `fotoStorage.generateUploadUrl` (URL ophalen, blob er rechtstreeks heen
 * POSTen), maar met het slot van de tijdlijn ervoor: een opname ís een
 * tijdlijn-entry in wording, dus alleen kantoor mag hem maken.
 */
export const generateOpnameUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Opruimen van een opname die nooit een entry is geworden: de gebruiker klikt
 * het paneel weg, of navigeert weg voordat hij iets vastlegt. Best effort —
 * de client wacht er niet op en een mislukte opruiming mag nergens een
 * foutmelding opleveren. Lukt het niet, dan blijft er een verweesde
 * audio-file staan; dat is minder erg dan een blokkade in de UI.
 *
 * Alleen kantoor, net als de rest van dit bestand. Er hangt bewust geen
 * eigenaarscontrole op het storage-object: een storageId van een opname is
 * alleen bekend bij de client die hem zojuist zelf heeft geüpload.
 */
export const verwijderOpname = mutation({
  args: { audioId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    try {
      await ctx.storage.delete(args.audioId);
      return { verwijderd: true };
    } catch (fout) {
      console.warn("verwijderOpname: opruimen mislukt", fout);
      return { verwijderd: false };
    }
  },
});
