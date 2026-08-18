/**
 * Vervallogica-engine — Convex-laag (PRD §3.3, fase 2 stap 3).
 *
 * Generieke engine `vervalItems`: naam, type (apk/keuring/certificaat/
 * verzekering/anders), gekoppeld object (voertuig/machine/vrij), vervaldatum,
 * waarschuwtermijn, ontvanger (rol óf specifieke gebruiker), actief.
 *
 * Dagelijkse cron (convex/crons.ts, zelfde engine-familie als de
 * planningsattendering en de debiteurenladder — pure kern in
 * vervalLogica.ts): binnen de waarschuwtermijn → onderhoudstaak op het
 * §2.4-cases-bord, idempotent via attenderingSleutel
 * `verval:{vervalItemId}:{vervaldatum}`. Optioneel (maakPlantaak) krijgt de
 * taak beoordelenVoorPlanning=true — de lichtste vorm waarmee "bus
 * wegbrengen" als interne opdracht op het planbord kan landen (kantoor
 * promoveert de taak vanuit het bord, bestaand §2.4-mechanisme).
 *
 * Deze module maakt TAKEN en verstuurt NOOIT e-mail. Tijdlijn-logging is
 * niet aan de orde: vervalitems zijn niet klant-gebonden (klantId ontbreekt
 * bewust op de gegenereerde taak).
 *
 * Rollen: kantoor beheert (requireKantoor); voorman/staf leest
 * (requireInterneRol). Fase 3 (HR-certificeringen §4.2) voegt alleen een
 * objectType toe — geen voertuig-specifieke velden in de kern.
 */

import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrg, requireOrgId } from "./auth";
import { normalizeRole, requireKantoor } from "./roles";
import { requireInterneRol } from "./tijdlijn";
import { voegSysteemCommentToe } from "./servicemeldingen";
import { vandaagIso } from "./beurtgenerator";
import {
  addDagen,
  maakVervalSleutel,
  resolveVervalOntvanger,
  vervalTaakNodig,
  vervalTaakTekst,
} from "./vervalLogica";

const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

const vervalTypeValidator = v.union(
  v.literal("apk"),
  v.literal("keuring"),
  v.literal("certificaat"),
  v.literal("verzekering"),
  v.literal("anders")
);

const objectTypeValidator = v.union(
  v.literal("voertuig"),
  v.literal("machine"),
  v.literal("vrij")
);

const ontvangerRolValidator = v.union(
  v.literal("kantoor"),
  v.literal("voorman")
);

/** Gedeelde veld-validatie voor create/update (fail-closed). */
function valideerVervalVelden(args: {
  naam?: string;
  vervaldatum?: string;
  waarschuwtermijnDagen?: number;
}): void {
  if (args.naam !== undefined && !args.naam.trim()) {
    throw new ConvexError("Naam is verplicht");
  }
  if (args.vervaldatum !== undefined && !DATUM_PATROON.test(args.vervaldatum)) {
    throw new ConvexError("Ongeldige vervaldatum (verwacht YYYY-MM-DD)");
  }
  if (
    args.waarschuwtermijnDagen !== undefined &&
    (!Number.isInteger(args.waarschuwtermijnDagen) ||
      args.waarschuwtermijnDagen < 0 ||
      args.waarschuwtermijnDagen > 365)
  ) {
    throw new ConvexError("Waarschuwtermijn moet 0–365 hele dagen zijn");
  }
}

/** Object-koppeling valideren binnen de eigen organisatie. */
async function valideerObjectKoppeling(
  ctx: { db: { get: (id: Id<"voertuigen"> | Id<"machines">) => Promise<Doc<"voertuigen"> | Doc<"machines"> | null> } },
  orgId: Id<"organisaties">,
  args: {
    objectType: "voertuig" | "machine" | "vrij";
    voertuigId?: Id<"voertuigen">;
    machineId?: Id<"machines">;
  }
): Promise<void> {
  if (args.objectType === "voertuig") {
    if (!args.voertuigId) throw new ConvexError("voertuigId is verplicht");
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Voertuig niet gevonden");
    }
  } else if (args.objectType === "machine") {
    if (!args.machineId) throw new ConvexError("machineId is verplicht");
    const machine = await ctx.db.get(args.machineId);
    if (!machine || machine.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Machine niet gevonden");
    }
  }
}

// ============================================
// Queries (staf leest)
// ============================================

/** Objectnaam voor weergave ("bus VW Crafter (12-AB-34)" / machinenaam). */
async function objectNaam(
  ctx: { db: { get: (id: Id<"voertuigen"> | Id<"machines">) => Promise<Doc<"voertuigen"> | Doc<"machines"> | null> } },
  item: Doc<"vervalItems">
): Promise<string | null> {
  if (item.objectType === "voertuig" && item.voertuigId) {
    const voertuig = (await ctx.db.get(item.voertuigId)) as Doc<"voertuigen"> | null;
    return voertuig ? `${voertuig.merk} ${voertuig.model} (${voertuig.kenteken})` : null;
  }
  if (item.objectType === "machine" && item.machineId) {
    const machine = (await ctx.db.get(item.machineId)) as Doc<"machines"> | null;
    return machine?.naam ?? null;
  }
  return null;
}

/**
 * Alle vervalitems van het bedrijf, verrijkt met objectnaam en dagen tot
 * verval. Optioneel gefilterd op object (machinepark-detailkaart).
 */
export const list = query({
  args: {
    voertuigId: v.optional(v.id("voertuigen")),
    machineId: v.optional(v.id("machines")),
    alleenActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);

    let items: Doc<"vervalItems">[];
    if (args.voertuigId) {
      items = await ctx.db
        .query("vervalItems")
        .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId))
        .collect();
    } else if (args.machineId) {
      items = await ctx.db
        .query("vervalItems")
        .withIndex("by_machine", (q) => q.eq("machineId", args.machineId))
        .collect();
    } else {
      items = await ctx.db
        .query("vervalItems")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    }

    // by_voertuig/by_machine zijn bedrijfsoverstijgend: belt & braces op de org.
    const relevant = items.filter(
      (i) =>
        i.orgId?.toString() === orgId.toString() &&
        (!args.alleenActief || i.actief)
    );

    const verrijkt = [];
    for (const item of relevant) {
      verrijkt.push({
        ...item,
        objectNaam: await objectNaam(ctx, item),
      });
    }
    return verrijkt.sort((a, b) => a.vervaldatum.localeCompare(b.vervaldatum));
  },
});

/**
 * "Verloopt binnenkort"-overzicht: actieve items waarvan de waarschuwtermijn
 * bereikt is (of die al verlopen zijn), gesorteerd op vervaldatum.
 */
export const verlooptBinnenkort = query({
  args: {},
  handler: async (ctx) => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);
    const vandaag = vandaagIso();

    const items = await ctx.db
      .query("vervalItems")
      .withIndex("by_org_actief", (q) =>
        q.eq("orgId", orgId).eq("actief", true)
      )
      .collect();

    const binnenkort = items.filter((i) => vervalTaakNodig(i, vandaag));
    const verrijkt = [];
    for (const item of binnenkort) {
      verrijkt.push({
        ...item,
        objectNaam: await objectNaam(ctx, item),
        tekst: vervalTaakTekst(item, vandaag),
        verlopen: item.vervaldatum < vandaag,
      });
    }
    return verrijkt.sort((a, b) => a.vervaldatum.localeCompare(b.vervaldatum));
  },
});

// ============================================
// Mutations (kantoor beheert)
// ============================================

export const create = mutation({
  args: {
    naam: v.string(),
    type: vervalTypeValidator,
    objectType: objectTypeValidator,
    voertuigId: v.optional(v.id("voertuigen")),
    machineId: v.optional(v.id("machines")),
    vervaldatum: v.string(), // YYYY-MM-DD
    waarschuwtermijnDagen: v.number(),
    ontvangerRol: v.optional(ontvangerRolValidator),
    ontvangerGebruikerId: v.optional(v.id("users")),
    maakPlantaak: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const org = await requireOrg(ctx);
    valideerVervalVelden(args);
    await valideerObjectKoppeling(ctx, org._id, args);
    if (args.ontvangerGebruikerId) {
      const ontvanger = await ctx.db.get(args.ontvangerGebruikerId);
      if (!ontvanger) throw new ConvexError("Ontvanger niet gevonden");
    }

    const now = Date.now();
    return await ctx.db.insert("vervalItems", {
      orgId: org._id,
      naam: args.naam.trim(),
      type: args.type,
      objectType: args.objectType,
      voertuigId: args.objectType === "voertuig" ? args.voertuigId : undefined,
      machineId: args.objectType === "machine" ? args.machineId : undefined,
      vervaldatum: args.vervaldatum,
      waarschuwtermijnDagen: args.waarschuwtermijnDagen,
      ontvangerRol: args.ontvangerRol ?? "kantoor",
      ontvangerGebruikerId: args.ontvangerGebruikerId,
      maakPlantaak: args.maakPlantaak ?? false,
      actief: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("vervalItems"),
    naam: v.optional(v.string()),
    type: v.optional(vervalTypeValidator),
    vervaldatum: v.optional(v.string()),
    waarschuwtermijnDagen: v.optional(v.number()),
    ontvangerRol: v.optional(ontvangerRolValidator),
    ontvangerGebruikerId: v.optional(v.id("users")),
    maakPlantaak: v.optional(v.boolean()),
    actief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Vervalitem niet gevonden");
    }
    valideerVervalVelden(args);
    if (args.ontvangerGebruikerId) {
      const ontvanger = await ctx.db.get(args.ontvangerGebruikerId);
      if (!ontvanger) throw new ConvexError("Ontvanger niet gevonden");
    }

    const { id: _id, ...wijzigingen } = args;
    const updates: Partial<Doc<"vervalItems">> = { updatedAt: Date.now() };
    if (wijzigingen.naam !== undefined) updates.naam = wijzigingen.naam.trim();
    if (wijzigingen.type !== undefined) updates.type = wijzigingen.type;
    if (wijzigingen.vervaldatum !== undefined)
      updates.vervaldatum = wijzigingen.vervaldatum;
    if (wijzigingen.waarschuwtermijnDagen !== undefined)
      updates.waarschuwtermijnDagen = wijzigingen.waarschuwtermijnDagen;
    if (wijzigingen.ontvangerRol !== undefined)
      updates.ontvangerRol = wijzigingen.ontvangerRol;
    if (wijzigingen.ontvangerGebruikerId !== undefined)
      updates.ontvangerGebruikerId = wijzigingen.ontvangerGebruikerId;
    if (wijzigingen.maakPlantaak !== undefined)
      updates.maakPlantaak = wijzigingen.maakPlantaak;
    if (wijzigingen.actief !== undefined) updates.actief = wijzigingen.actief;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/** Verwijderen = deactiveren zou ook kunnen, maar een vervalitem zonder
 * historische betekenis mag hard weg (de gegenereerde taken blijven staan). */
export const remove = mutation({
  args: { id: v.id("vervalItems") },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Vervalitem niet gevonden");
    }
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// ============================================
// Cron — onderhoudstaken genereren (intern, geen mail)
// ============================================

/**
 * Dagelijkse verval-run (cron). Per ORGANISATIE: actieve vervalitems binnen
 * de waarschuwtermijn → onderhoudstaak op het §2.4-cases-bord. Idempotent via
 * attenderingSleutel; verstuurt NOOIT e-mail; respecteert actief=false en de
 * ontvanger (specifieke gebruiker > rol voorman > kantoor/eigenaar).
 *
 * TENANT ZONDER IDENTITY: een cron heeft geen JWT en dus geen `org_id`-claim,
 * waardoor `requireOrg` hier per definitie niet kan werken. De run itereert
 * daarom zelf over de ACTIEVE organisaties (zelfde keuze als de andere
 * engine-crons) en scoopt elke ronde met `by_org_actief`. Een uitgezette
 * organisatie krijgt bewust geen taken.
 *
 * De cron heeft geen ingelogde gebruiker, dus is de fallback-ontvanger de
 * eigenaar van de organisatie (`organisaties.eigenaarUserId`).
 */
export const genereerVervalTaken = internalMutation({
  args: {},
  handler: async (ctx) => {
    const vandaag = vandaagIso();
    const organisaties = (await ctx.db.query("organisaties").collect()).filter(
      (o) => o.actief
    );
    // users heeft (nog) geen orgId; de koppeling loopt via medewerkers.by_org.
    const users = await ctx.db.query("users").collect();

    let aangemaakt = 0;
    for (const org of organisaties) {
      const items = await ctx.db
        .query("vervalItems")
        .withIndex("by_org_actief", (q) =>
          q.eq("orgId", org._id).eq("actief", true)
        )
        .collect();
      if (items.length === 0) continue;

      // De taak heeft een eigenaar nodig (PRD §2.4). Zonder directie-account
      // op de organisatie is die er niet en slaan we de hele org over.
      const eigenaar = org.eigenaarUserId
        ? await ctx.db.get(org.eigenaarUserId)
        : null;
      if (!eigenaar) {
        console.warn(
          `[vervalItems] organisatie ${org._id} heeft geen eigenaar-account — overgeslagen`
        );
        continue;
      }

      // Bedrijfsgebruikers voor ontvanger-resolutie: gebruikers wier
      // gekoppelde medewerker bij deze organisatie hoort, plus de eigenaar
      // (directie heeft geen medewerker-rij).
      const medewerkers = await ctx.db
        .query("medewerkers")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();
      const medewerkerIds = new Set(medewerkers.map((m) => m._id.toString()));
      const bedrijfsGebruikers = users.filter(
        (u) =>
          u._id.toString() === eigenaar._id.toString() ||
          (u.linkedMedewerkerId &&
            medewerkerIds.has(u.linkedMedewerkerId.toString()))
      );

      for (const item of items) {
        // Belt & braces bovenop de indexquery
        if (item.orgId?.toString() !== org._id.toString()) continue;
        if (!vervalTaakNodig(item, vandaag)) continue;

        // Idempotentie: bestaat de onderhoudstaak voor deze occurrence al?
        const sleutel = maakVervalSleutel(item._id.toString(), item.vervaldatum);
        const bestaande = await ctx.db
          .query("servicemeldingen")
          .withIndex("by_attenderingSleutel", (q) =>
            q.eq("attenderingSleutel", sleutel)
          )
          .collect();
        if (bestaande.some((m) => m.attenderingSleutel === sleutel)) continue;

        const naamMetObject = await objectNaam(ctx, item);
        const tekst = vervalTaakTekst(
          {
            naam: naamMetObject ? `${item.naam} — ${naamMetObject}` : item.naam,
            type: item.type,
            vervaldatum: item.vervaldatum,
          },
          vandaag
        );
        const ontvanger = resolveVervalOntvanger(
          {
            ontvangerGebruikerId: item.ontvangerGebruikerId?.toString(),
            ontvangerRol: item.ontvangerRol,
          },
          bedrijfsGebruikers,
          eigenaar,
          (role) => normalizeRole(role)
        );

        const now = Date.now();
        const meldingId = await ctx.db.insert("servicemeldingen", {
          orgId: org._id,
          // GEEN klantId: vervalitems zijn niet klant-gebonden (§3.3);
          // daarom ook geen klanttijdlijn-log.
          beschrijving: tekst,
          isGarantie: false,
          status: "nieuw",
          prioriteit: "normaal",
          kosten: 0,
          kanaal: "intern",
          eigenaarId: ontvanger._id,
          taaksoort: "onderhoudstaak",
          attenderingSleutel: sleutel,
          // De taak wordt actueel op vervaldatum − termijn; deadline = de
          // vervaldatum zelf (escalatiekleur via het bestaande §2.4-mechanisme)
          deadline: item.vervaldatum,
          // Optionele automatische plantaak: markeer voor de planning-
          // beoordeling ("bus wegbrengen" als interne opdracht op het bord)
          beoordelenVoorPlanning: item.maakPlantaak === true ? true : undefined,
          createdAt: now,
          updatedAt: now,
        });

        // Systeem-comment via de gedeelde helper (cluster 3.7). Identity-loos
        // pad: de org komt expliciet mee, niet uit een JWT.
        await voegSysteemCommentToe(ctx, {
          orgId: org._id,
          meldingId,
          tekst: `Automatische vervalattendering: ${tekst} (waarschuwtermijn ${item.waarschuwtermijnDagen} dagen, taak sinds ${addDagen(item.vervaldatum, -item.waarschuwtermijnDagen)})`,
        });
        aangemaakt++;
      }
    }

    console.log(`[vervalItems] run klaar: ${aangemaakt} nieuwe onderhoudstaken`);
    return { aangemaakt };
  },
});
