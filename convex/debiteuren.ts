/**
 * Debiteurenladder (PRD §3.2, fase 2) — cron, pauzeren en openstaand-overzicht.
 *
 * ── Model ──────────────────────────────────────────────────────────────────
 * - Treden (max 4, instelbaar via instellingen.debiteurenLadder; defaults in
 *   debiteurenLogica.ts): dag 14 herinnering → dag 21 tweede herinnering →
 *   dag 28 interne taak "bellen/aanmaning" voor kantoor.
 * - Ankerdatum = verzenddatum (verzondenAt, fallback factuurdatum).
 * - Alleen facturen met documentStatus "verzonden" en betaalStatus
 *   open/gedeeltelijk_betaald; deelbetaling verandert de ladder niet,
 *   volledige betaling (of annulering) stopt hem vanzelf.
 *
 * ── Mailveiligheid (§1.2) ──────────────────────────────────────────────────
 * De cron VERSTUURT ZELF NOOIT e-mail. Mail-treden lopen via
 * zetTriggerMailKlaar (§2.7): default als CONCEPT in de goedkeurings-
 * wachtrij; kantoor kan het trigger-record per trede op "automatisch"
 * zetten en ook dat pad blijft achter de mail-guard (fail-closed).
 *
 * ── Eén bron van waarheid ──────────────────────────────────────────────────
 * De ladder logt in de bestaande tabel betalingsherinneringen (trede +
 * bron "ladder"). Handmatige herinneringen/aanmaningen (FAC-006/007)
 * tellen via tredeNiveauVanRecord mee als afgedekte treden — de ladder
 * dubbelt dus nooit met wat kantoor al verstuurde. Het oude automatische
 * cron-pad (processAutomatischeHerinneringen) is hierdoor VERVANGEN.
 *
 * Idempotentie per factuur + trede: (1) een bestaand ladder-record dekt de
 * trede af, (2) dedupeSleutel `debiteur:{factuurId}:{trede}` op de
 * concept-mail, (3) attenderingSleutel met dezelfde sleutel op de taak.
 */

import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuthUserId } from "./auth";
import { requireKantoor, isKantoorRol } from "./roles";
import { effectieveStatussen } from "./facturatieLogica";
import { logTijdlijnEvent } from "./tijdlijn";
import { voegSysteemCommentToe } from "./servicemeldingen";
import { zetTriggerMailKlaar, mailEventVoorTrede } from "./mailTriggers";
import {
  DAG_MS,
  MAX_TREDEN,
  type LadderTrede,
  type LadderInstellingen,
  DEBITEUREN_LADDER_DEFAULTS,
  effectieveTreden,
  valideerTreden,
  ladderVanToepassing,
  debiteurSleutel,
  hoogsteAfgedekteTrede,
  bepaalVolgendeTrede,
  eerstvolgendeTrede,
  dagenVerschuldigd,
  ouderdomsBucket,
  openstaandBedrag,
  tredeRecordType,
} from "./debiteurenLogica";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const euro = (bedrag: number): string =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(bedrag);

const nlDatum = (ts: number): string =>
  new Date(ts).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Ankerdatum van de ladder: verzenddatum, fallback factuurdatum. */
function ankerdatum(factuur: Doc<"facturen">): number {
  return factuur.verzondenAt ?? factuur.factuurdatum;
}

async function ladderRecordsVoorFactuur(
  ctx: QueryCtx | MutationCtx,
  factuurId: Id<"facturen">
): Promise<Doc<"betalingsherinneringen">[]> {
  const records = await ctx.db
    .query("betalingsherinneringen")
    .withIndex("by_factuur", (q) => q.eq("factuurId", factuurId))
    .collect();
  // Dubbel filteren op factuurId is een no-op in productie (de index doet
  // het al) maar houdt de logica correct onder de test-mock.
  return records.filter((r) => r.factuurId === factuurId);
}

// ─── Instellingen (kantoor) ──────────────────────────────────────────────────

const tredenValidator = v.array(
  v.object({
    trede: v.number(),
    dagenNaVerzending: v.number(),
    escalatie: v.union(v.literal("mail"), v.literal("interne_taak")),
    actief: v.optional(v.boolean()),
  })
);

/**
 * Ladder-configuratie voor de instellingen-UI: opgeslagen waarden met
 * defaults ingevuld (dag 14/21/28), zodat de UI altijd iets toont.
 */
export const getLadderInstellingen = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const ladder = (settings?.debiteurenLadder ?? {}) as LadderInstellingen;
    return {
      actief: ladder.actief ?? true,
      taakEigenaarId: ladder.taakEigenaarId ?? null,
      treden:
        ladder.treden && ladder.treden.length > 0
          ? ladder.treden
          : DEBITEUREN_LADDER_DEFAULTS,
      maxTreden: MAX_TREDEN,
    };
  },
});

/**
 * Kantoor-gebruikers voor de taak-eigenaar-kiezer (PRD noemt Elke als
 * default, maar het is bewust een INSTELLING — geen hardcoded naam).
 */
export const listKantoorGebruikers = query({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => isKantoorRol(u.role))
      .map((u) => ({ _id: u._id, name: u.name, email: u.email }));
  },
});

/** Ladder-instellingen bijwerken — kantoor-only (rolcheck-eis §3.2). */
export const updateLadderInstellingen = mutation({
  args: {
    actief: v.optional(v.boolean()),
    taakEigenaarId: v.optional(v.id("users")),
    treden: v.optional(tredenValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);
    if (args.treden) valideerTreden(args.treden);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!settings) {
      throw new ConvexError(
        "Instellingen niet gevonden. Maak eerst standaardinstellingen aan."
      );
    }

    const huidig = (settings.debiteurenLadder ?? {}) as LadderInstellingen;
    await ctx.db.patch(settings._id, {
      debiteurenLadder: {
        actief: args.actief ?? huidig.actief ?? true,
        taakEigenaarId: (args.taakEigenaarId ??
          huidig.taakEigenaarId) as Id<"users"> | undefined,
        treden: (args.treden ?? huidig.treden ?? DEBITEUREN_LADDER_DEFAULTS).map(
          (t) => ({
            trede: t.trede,
            dagenNaVerzending: t.dagenNaVerzending,
            escalatie: t.escalatie,
            actief: t.actief ?? true,
          })
        ),
      },
    });
    return settings._id;
  },
});

// ─── Pauzeren / hervatten / trede overslaan (kantoor) ────────────────────────

async function requireEigenFactuur(
  ctx: Parameters<typeof requireKantoor>[0],
  factuurId: Id<"facturen">
): Promise<{ user: Doc<"users">; factuur: Doc<"facturen"> }> {
  const user = await requireKantoor(ctx);
  const factuur = await ctx.db.get(factuurId);
  if (!factuur) throw new ConvexError("Factuur niet gevonden");
  return { user, factuur };
}

/**
 * Ladder pauzeren voor één factuur (bv. betalingsafspraak). De reden is
 * verplicht en zichtbaar op de factuur én op de klanttijdlijn.
 */
export const pauzeerLadder = mutation({
  args: { factuurId: v.id("facturen"), reden: v.string() },
  handler: async (ctx, args) => {
    const { user, factuur } = await requireEigenFactuur(ctx, args.factuurId);
    const reden = args.reden.trim();
    if (reden.length === 0) {
      throw new ConvexError(
        "Een reden is verplicht bij het pauzeren van de ladder"
      );
    }
    const now = Date.now();
    await ctx.db.patch(args.factuurId, {
      ladderGepauzeerd: true,
      ladderPauzeReden: reden,
      ladderPauzeAt: now,
      updatedAt: now,
    });
    if (factuur.klantId) {
      await logTijdlijnEvent(ctx, {
        userId: factuur.userId,
        klantId: factuur.klantId,
        eventType: "debiteurenladder_gepauzeerd",
        tekst: `Debiteurenladder gepauzeerd voor factuur ${factuur.factuurnummer}: ${reden}`,
        auteurId: user._id,
        auteurNaam: user.name,
      });
    }
    return args.factuurId;
  },
});

/** Ladder hervatten na een pauze. */
export const hervatLadder = mutation({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    const { user, factuur } = await requireEigenFactuur(ctx, args.factuurId);
    const now = Date.now();
    await ctx.db.patch(args.factuurId, {
      ladderGepauzeerd: false,
      ladderPauzeReden: undefined,
      ladderPauzeAt: undefined,
      updatedAt: now,
    });
    if (factuur.klantId) {
      await logTijdlijnEvent(ctx, {
        userId: factuur.userId,
        klantId: factuur.klantId,
        eventType: "debiteurenladder_hervat",
        tekst: `Debiteurenladder hervat voor factuur ${factuur.factuurnummer}`,
        auteurId: user._id,
        auteurNaam: user.name,
      });
    }
    return args.factuurId;
  },
});

/**
 * Eén trede overslaan: de eerstvolgende nog niet afgedekte trede wordt als
 * verwerkt gemarkeerd (de cron slaat hem over) — bv. "geen tweede
 * herinnering nodig, we bellen al".
 */
export const slaTredeOver = mutation({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    const { user, factuur } = await requireEigenFactuur(ctx, args.factuurId);

    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", factuur.userId))
      .unique();
    const treden = effectieveTreden(
      settings?.debiteurenLadder as LadderInstellingen | undefined
    );
    const records = await ladderRecordsVoorFactuur(ctx, args.factuurId);
    const afgedekt = hoogsteAfgedekteTrede(
      records,
      factuur.ladderOvergeslagenTreden
    );
    const volgende = eerstvolgendeTrede(treden, afgedekt);
    if (!volgende) {
      throw new ConvexError("Er is geen trede meer om over te slaan");
    }

    const now = Date.now();
    await ctx.db.patch(args.factuurId, {
      ladderOvergeslagenTreden: [
        ...(factuur.ladderOvergeslagenTreden ?? []),
        volgende.trede,
      ],
      updatedAt: now,
    });
    if (factuur.klantId) {
      await logTijdlijnEvent(ctx, {
        userId: factuur.userId,
        klantId: factuur.klantId,
        eventType: "debiteurenladder_trede_overgeslagen",
        tekst: `Trede ${volgende.trede} van de debiteurenladder overgeslagen voor factuur ${factuur.factuurnummer}`,
        auteurId: user._id,
        auteurNaam: user.name,
      });
    }
    return { overgeslagenTrede: volgende.trede };
  },
});

// ─── Dagelijkse cron ─────────────────────────────────────────────────────────

/**
 * Dagelijkse ladder-run (crons.ts, 08:00 UTC). Per factuur wordt hooguit
 * ÉÉN trede uitgevoerd: de hoogste vervallen trede die nog niet is
 * afgedekt (dus geen salvo van drie herinneringen bij een oude factuur).
 *
 * Idempotent: dezelfde dag twee keer draaien maakt geen tweede concept of
 * taak (record per factuur+trede + dedupe-/attenderingSleutel).
 */
export const verwerkLadder = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let mailsKlaargezet = 0;
    let takenAangemaakt = 0;
    let overgeslagen = 0;

    // Kandidaten via de legacy-spiegel (dual-write §2.8): documentStatus
    // "verzonden" heeft altijd legacy-status verzonden/betaald/vervallen.
    const kandidaten = new Map<Id<"facturen">, Doc<"facturen">>();
    for (const status of ["verzonden", "vervallen"] as const) {
      const rows = await ctx.db
        .query("facturen")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      for (const f of rows) kandidaten.set(f._id, f);
    }

    // Ladder-instellingen per bedrijf (userId) één keer ophalen
    const configCache = new Map<
      string,
      { actief: boolean; taakEigenaarId?: Id<"users">; treden: LadderTrede[] }
    >();

    for (const factuur of kandidaten.values()) {
      const statussen = effectieveStatussen(factuur);
      if (
        !ladderVanToepassing({
          documentStatus: statussen.documentStatus,
          betaalStatus: statussen.betaalStatus,
          isCreditnota: factuur.isCreditnota,
        })
      ) {
        continue;
      }
      // Gepauzeerd (betalingsafspraak) = cron slaat de factuur over
      if (factuur.ladderGepauzeerd) {
        overgeslagen++;
        continue;
      }

      const cacheSleutel = factuur.userId.toString();
      let config = configCache.get(cacheSleutel);
      if (!config) {
        const settings = await ctx.db
          .query("instellingen")
          .withIndex("by_user", (q) => q.eq("userId", factuur.userId))
          .unique();
        const ladder = (settings?.debiteurenLadder ??
          {}) as LadderInstellingen;
        config = {
          actief: ladder.actief ?? true,
          taakEigenaarId: ladder.taakEigenaarId as Id<"users"> | undefined,
          treden: effectieveTreden(ladder),
        };
        configCache.set(cacheSleutel, config);
      }
      if (!config.actief) continue;

      const dagen = Math.floor((now - ankerdatum(factuur)) / DAG_MS);
      const records = await ladderRecordsVoorFactuur(ctx, factuur._id);
      const afgedekt = hoogsteAfgedekteTrede(
        records,
        factuur.ladderOvergeslagenTreden
      );
      const trede = bepaalVolgendeTrede(config.treden, dagen, afgedekt);
      if (!trede) continue;

      if (trede.escalatie === "mail") {
        const klaargezet = await verwerkMailTrede(ctx, factuur, trede, dagen);
        if (klaargezet) mailsKlaargezet++;
      } else {
        const aangemaakt = await verwerkTaakTrede(
          ctx,
          factuur,
          trede,
          dagen,
          config.taakEigenaarId
        );
        if (aangemaakt) takenAangemaakt++;
      }
    }

    console.log(
      `[debiteuren] ladder-run klaar: ${mailsKlaargezet} concept-mails, ${takenAangemaakt} taken, ${overgeslagen} gepauzeerd`
    );
    return { mailsKlaargezet, takenAangemaakt, overgeslagen };
  },
});

type LadderCtx = MutationCtx;

/**
 * Mail-trede: herinneringsmail als CONCEPT in de wachtrij (of, als kantoor
 * de trigger op "automatisch" zette, via het guarded verzendpad — §2.7).
 */
async function verwerkMailTrede(
  ctx: LadderCtx,
  factuur: Doc<"facturen">,
  trede: LadderTrede,
  dagen: number
): Promise<boolean> {
  const now = Date.now();
  const open = openstaandBedrag(factuur);

  const resultaat = await zetTriggerMailKlaar(ctx, {
    event: mailEventVoorTrede(trede.trede),
    userId: factuur.userId,
    ontvangerEmail: factuur.klant.email ?? "",
    ontvangerNaam: factuur.klant.naam,
    variabelen: {
      klantnaam: factuur.klant.naam,
      factuurnummer: factuur.factuurnummer,
      factuurbedrag: euro(factuur.totaalInclBtw),
      openstaandBedrag: euro(open),
      vervaldatum: nlDatum(factuur.vervaldatum),
    },
    klantId: factuur.klantId,
    dedupeSleutel: debiteurSleutel(factuur._id.toString(), trede.trede),
  });

  if (!resultaat.aangemaakt && resultaat.reden !== "duplicaat") {
    // geen_trigger / trigger_inactief / geen_email: record uit = mail uit
    // (§2.7). Geen ladder-record — kantoor ziet de factuur in het
    // openstaand-overzicht gewoon op het oude niveau staan.
    console.log(
      `[debiteuren] trede ${trede.trede} niet klaargezet (${resultaat.reden}) voor factuur ${factuur.factuurnummer}`
    );
    return false;
  }

  // Record per factuur+trede (idempotentie + aanmaanniveau in de lijst).
  // Bij "duplicaat" bestond de concept-mail al maar het record nog niet
  // (bv. crash tussen twee writes) — dan alleen het record herstellen.
  await ctx.db.insert("betalingsherinneringen", {
    factuurId: factuur._id,
    userId: factuur.userId,
    type: tredeRecordType(trede),
    volgnummer: 1,
    dagenVervallen: dagenVerschuldigd(factuur.vervaldatum, now),
    verstuurdAt: now,
    // Nog niet verstuurd: de mail staat als concept in de wachtrij
    emailVerstuurd: false,
    notities: `Debiteurenladder trede ${trede.trede} (dag ${dagen} na verzending): concept-mail klaargezet`,
    trede: trede.trede,
    bron: "ladder",
    conceptMailId: resultaat.aangemaakt ? resultaat.conceptMailId : undefined,
  });

  if (factuur.klantId) {
    await logTijdlijnEvent(ctx, {
      userId: factuur.userId,
      klantId: factuur.klantId,
      eventType: "betalingsherinnering_klaargezet",
      tekst: `Betalingsherinnering (trede ${trede.trede}) klaargezet voor factuur ${factuur.factuurnummer} — ${dagen} dagen na verzending`,
    });
  }
  return true;
}

/**
 * Taak-trede (default trede 3, dag 28): interne kantoor-taak
 * "bellen/aanmaning" op het cases-bord (taaksoort-patroon van de
 * planningsattendering, §2.4/§8.12). Eigenaar instelbaar; default de
 * bedrijfseigenaar van de factuur.
 */
async function verwerkTaakTrede(
  ctx: LadderCtx,
  factuur: Doc<"facturen">,
  trede: LadderTrede,
  dagen: number,
  taakEigenaarId: Id<"users"> | undefined
): Promise<boolean> {
  if (!factuur.klantId) {
    // Zonder klantkoppeling kan er geen case aangemaakt worden; de factuur
    // blijft zichtbaar in het openstaand-overzicht op het huidige niveau.
    console.warn(
      `[debiteuren] trede ${trede.trede} overgeslagen: factuur ${factuur.factuurnummer} heeft geen klantId`
    );
    return false;
  }

  const sleutel = debiteurSleutel(factuur._id.toString(), trede.trede);
  const bestaande = await ctx.db
    .query("servicemeldingen")
    .withIndex("by_attenderingSleutel", (q) =>
      q.eq("attenderingSleutel", sleutel)
    )
    .collect();
  if (bestaande.some((m) => m.attenderingSleutel === sleutel)) return false;

  const now = Date.now();
  const open = openstaandBedrag(factuur);
  const tekst = `Debiteurenactie: bellen/aanmaning — factuur ${factuur.factuurnummer} (${euro(
    open
  )} openstaand) is ${dagen} dagen na verzending nog niet betaald.`;

  const meldingId = await ctx.db.insert("servicemeldingen", {
    userId: factuur.userId,
    klantId: factuur.klantId,
    beschrijving: tekst,
    isGarantie: false,
    status: "nieuw",
    prioriteit: "hoog",
    kosten: 0,
    kanaal: "intern",
    eigenaarId: taakEigenaarId ?? factuur.userId,
    taaksoort: "debiteurentaak",
    attenderingSleutel: sleutel,
    createdAt: now,
    updatedAt: now,
  });

  await voegSysteemCommentToe(ctx, {
    userId: factuur.userId,
    meldingId,
    tekst: `Automatische debiteurenladder (trede ${trede.trede}): ${tekst}`,
  });

  await ctx.db.insert("betalingsherinneringen", {
    factuurId: factuur._id,
    userId: factuur.userId,
    type: "interne_taak",
    volgnummer: 1,
    dagenVervallen: dagenVerschuldigd(factuur.vervaldatum, now),
    verstuurdAt: now,
    emailVerstuurd: false,
    notities: `Debiteurenladder trede ${trede.trede} (dag ${dagen} na verzending): interne taak aangemaakt`,
    trede: trede.trede,
    bron: "ladder",
    meldingId,
  });

  await logTijdlijnEvent(ctx, {
    userId: factuur.userId,
    klantId: factuur.klantId,
    eventType: "debiteurentaak_aangemaakt",
    tekst: `Interne taak (bellen/aanmaning) aangemaakt voor factuur ${factuur.factuurnummer} — trede ${trede.trede}, ${dagen} dagen na verzending`,
    meldingId,
  });
  return true;
}

// ─── Openstaande-postenoverzicht (§3.2: de lijst ís het overzicht) ───────────

/**
 * Alle openstaande facturen (verzonden + open/gedeeltelijk betaald) met
 * "verschuldigd sinds", ouderdomsbucket, aanmaanniveau en pauze-status,
 * plus totalen per bucket.
 */
export const getOpenstaand = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Alle herinnering-records van deze gebruiker één keer ophalen (geen
    // N+1) en per factuur groeperen.
    const alleRecords = await ctx.db
      .query("betalingsherinneringen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const recordsPerFactuur = new Map<string, typeof alleRecords>();
    for (const r of alleRecords) {
      if (r.userId.toString() !== userId.toString()) continue;
      const sleutel = r.factuurId.toString();
      const lijst = recordsPerFactuur.get(sleutel) ?? [];
      lijst.push(r);
      recordsPerFactuur.set(sleutel, lijst);
    }

    // Instellingen voor de eerstvolgende-trede-weergave
    const settings = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const ladder = (settings?.debiteurenLadder ?? {}) as LadderInstellingen;
    const treden = effectieveTreden(ladder);

    const posten = [];
    const totalen = {
      totaalOpenstaand: 0,
      aantal: 0,
      buckets: {
        "0_14": { aantal: 0, bedrag: 0 },
        "14_30": { aantal: 0, bedrag: 0 },
        "30_60": { aantal: 0, bedrag: 0 },
        "60_plus": { aantal: 0, bedrag: 0 },
      } as Record<string, { aantal: number; bedrag: number }>,
    };

    for (const factuur of facturen) {
      if (factuur.userId.toString() !== userId.toString()) continue;
      const statussen = effectieveStatussen(factuur);
      if (
        !ladderVanToepassing({
          documentStatus: statussen.documentStatus,
          betaalStatus: statussen.betaalStatus,
          isCreditnota: factuur.isCreditnota,
        })
      ) {
        continue;
      }

      const records = recordsPerFactuur.get(factuur._id.toString()) ?? [];
      const afgedekt = hoogsteAfgedekteTrede(
        records,
        factuur.ladderOvergeslagenTreden
      );
      const volgende = eerstvolgendeTrede(treden, afgedekt);
      const dagen = dagenVerschuldigd(factuur.vervaldatum, now);
      const bucket = ouderdomsBucket(dagen);
      const open = openstaandBedrag(factuur);
      const dagenSindsVerzending = Math.floor(
        (now - ankerdatum(factuur)) / DAG_MS
      );

      posten.push({
        factuurId: factuur._id,
        factuurnummer: factuur.factuurnummer,
        klantId: factuur.klantId ?? null,
        klantNaam: factuur.klant.naam,
        totaalInclBtw: factuur.totaalInclBtw,
        betaaldBedrag: factuur.betaaldBedrag ?? 0,
        openstaandBedrag: open,
        betaalStatus: statussen.betaalStatus,
        vervaldatum: factuur.vervaldatum,
        // "Verschuldigd sinds": dagen sinds de vervaldatum (HERO-les)
        dagenVerschuldigd: dagen,
        bucket,
        dagenSindsVerzending,
        aanmaanniveau: afgedekt,
        volgendeTrede: volgende
          ? {
              trede: volgende.trede,
              escalatie: volgende.escalatie,
              opDagen: volgende.dagenNaVerzending,
            }
          : null,
        gepauzeerd: factuur.ladderGepauzeerd ?? false,
        pauzeReden: factuur.ladderPauzeReden ?? null,
        overgeslagenTreden: factuur.ladderOvergeslagenTreden ?? [],
      });

      totalen.totaalOpenstaand += open;
      totalen.aantal++;
      totalen.buckets[bucket].aantal++;
      totalen.buckets[bucket].bedrag += open;
    }

    // Oudste bovenaan: daar zit de actie
    posten.sort((a, b) => b.dagenVerschuldigd - a.dagenVerschuldigd);

    return { posten, totalen };
  },
});
