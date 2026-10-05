import { bezoekLedenVoor } from "./lib/bezoekBemanning";
import { effectieveMateriaalRegels, materiaalSuggesties } from "./lib/materiaalSuggesties";
import { werkitemOpDag } from "./planbordLogica";
/**
 * Materiaaldelta-checklist + route-knop — veld-rol (PRD §2.6/§8.5, stap 9a).
 *
 * Vóór vertrek naar een klus toont de route-knop eerst de delta-checklist:
 * (materiaal/machines uit de bouwsteen-koppelingen van de geplande taken —
 * dezelfde receptuurdata als de offerte) MINUS (standaardinventaris van de
 * bus, voertuigUitrusting). §8.5: standaardbus heeft alles behalve grasmaaier
 * → checklist toont alleen "grasmaaier". Afvinken wordt gelogd (wie/wanneer)
 * in materiaalChecks; daarna pas door naar Maps (gewone URL, geen API).
 *
 * BUS-KETEN (PRD §3.3, fase 2 — lost de fase 1-aanname
 * "toegewezenVoertuigen[0]" op). De bus voor werkitem + dag is, in volgorde:
 *   1. expliciete voertuigId in de aanroep (gebruiker kiest zelf);
 *   2. dag-override van het team (teamBusOverrides, team + datum);
 *   3. vaste standaardbus van het team (teams.standaardVoertuigId);
 *   4. vangnet = fase 1-gedrag: werkitem.toegewezenVoertuigen[0].
 * Stappen 2–4: bepaalEffectieveBus in convex/machineparkLogica.ts (puur).
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrgContext } from "./auth";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { CANONIEKE_ROL_MAPPING, normalizeRole } from "./roles";
import {
  berekenMateriaalDelta,
  magUrenLoggen,
  normaliseerItemNaam,
  type DeltaItem,
} from "./veldLogica";
import { bepaalEffectieveBus, type BusBron } from "./machineparkLogica";
import { laadDocsMap } from "./lib/batchLoad";
import {
  adresRegelOfNull,
  googleMapsRouteUrl,
  klantUitvoerAdres,
} from "./lib/adres";

const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Auth + rolcheck + tenant-scope. De scope is sinds fase 3 de organisatie uit
 * het Clerk-JWT: voor een veld-account levert dat exact hetzelfde bedrijfszicht
 * als `getCompanyUserId` (de omweg via de gekoppelde medewerker), maar nu zonder
 * die omweg.
 */
async function veldToegang(ctx: QueryCtx | MutationCtx) {
  const { org, user } = await requireOrgContext(ctx);
  const rol = CANONIEKE_ROL_MAPPING[normalizeRole(user.role)];
  if (!magUrenLoggen(rol)) {
    throw new ConvexError("Deze functie is niet beschikbaar voor deze rol");
  }
  return { user, orgId: org._id, rol };
}

function datumCheck(datum: string) {
  if (!DATUM_PATROON.test(datum) || !Number.isFinite(Date.parse(datum)) || new Date(datum).toISOString().slice(0, 10) !== datum) throw new ConvexError("Ongeldige datum");
}
async function controleerWerkitemToegang(ctx: QueryCtx | MutationCtx, toegang: Awaited<ReturnType<typeof veldToegang>>, werkitem: Doc<"projecten">, datum: string) {
  if (toegang.rol === "kantoor") return;
  const medewerkerId = toegang.user.linkedMedewerkerId;
  const medewerker = medewerkerId ? await ctx.db.get(medewerkerId) : null;
  if (!medewerkerId || !medewerker || medewerker.orgId !== toegang.orgId) throw new ConvexError("Geen gekoppelde medewerker");
  const leden = await bezoekLedenVoor(ctx.db, werkitem, datum);
  const uren = await ctx.db.query("urenSegmenten").withIndex("by_medewerker_datum", q => q.eq("medewerkerId", medewerkerId).eq("datum", datum)).collect();
  if (!(werkitemOpDag(werkitem, datum) && leden.includes(medewerkerId)) && !uren.some(s => s.orgId === toegang.orgId && s.werkitemId === werkitem._id && s.categorie === "werken")) throw new ConvexError("Je bent niet toegewezen aan deze klus");
}
async function suggestiesVoor(ctx: QueryCtx | MutationCtx, werkitem: Doc<"projecten">, orgId: Id<"organisaties">, bekend: string[] = []) {
  const overrides = await ctx.db.query("materiaalSuggestieRegels").withIndex("by_org", q => q.eq("orgId", orgId)).collect();
  const teksten = [werkitem.naam, werkitem.uitvoeringsInstructie ?? "", ...(werkitem.bouwsteenRegels ?? []).map(r => r.omschrijving)];
  return materiaalSuggesties(teksten.join(" "), effectieveMateriaalRegels(overrides), bekend);
}

/**
 * Delta-checklist voor één werkitem + bus. Zonder expliciete voertuigId
 * geldt de bus-keten hierboven (dag-override → standaardbus → fallback);
 * zonder bus is er geen inventaris en is de delta = alle benodigdheden
 * (fail-closed: liever te veel op de checklist dan te weinig in de bus).
 */
export const getDeltaChecklist = query({
  args: {
    werkitemId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD (voor de afvink-log van die dag)
    voertuigId: v.optional(v.id("voertuigen")),
  },
  handler: async (ctx, args) => {
    datumCheck(args.datum);
    const toegang = await veldToegang(ctx);
    const { orgId } = toegang;

    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.orgId?.toString() !== orgId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }
    await controleerWerkitemToegang(ctx, toegang, werkitem, args.datum);

    // Benodigd: producten + machines uit de bouwsteen-koppelingen van de taken
    let regels = werkitem.bouwsteenRegels ?? [];
    if (regels.length === 0 && werkitem.contractWerkzaamheidId) {
      const werkzaamheid = await ctx.db.get(werkitem.contractWerkzaamheidId);
      const contract = werkzaamheid ? await ctx.db.get(werkzaamheid.contractId) : null;
      if (werkzaamheid && contract?.orgId === orgId) {
        regels = [
          {
            bouwsteenId: werkzaamheid.bouwsteenId,
            omschrijving: werkzaamheid.omschrijving,
          },
        ];
      }
    }
    // N+1 weg (audit §5): drie rondes i.p.v. één get per bouwsteen en daarna
    // nog één per gekoppelde machine/product. Eerst de bouwstenen, dan in één
    // klap alle machines en producten waar die bouwstenen naar wijzen.
    const bouwsteenMap = await laadDocsMap(
      ctx,
      regels.map((r) => r.bouwsteenId)
    );
    const gebruikteBouwstenen = [...bouwsteenMap.values()].filter(b => b.orgId === orgId);
    const [machineMap, productMap] = await Promise.all([
      laadDocsMap(
        ctx,
        gebruikteBouwstenen.flatMap((b) => b.machineIds ?? [])
      ),
      laadDocsMap(
        ctx,
        gebruikteBouwstenen.flatMap((b) => b.productIds ?? [])
      ),
    ]);

    const benodigd: DeltaItem[] = [];
    for (const regel of regels) {
      if (!regel.bouwsteenId) continue;
      const bouwsteen = bouwsteenMap.get(regel.bouwsteenId.toString());
      if (!bouwsteen || bouwsteen.orgId !== orgId) continue;
      for (const machineId of bouwsteen.machineIds ?? []) {
        const machine = machineMap.get(machineId.toString());
        if (machine?.orgId === orgId) benodigd.push({ naam: machine.naam, soort: "machine" });
      }
      for (const productId of bouwsteen.productIds ?? []) {
        const product = productMap.get(productId.toString());
        if (product?.orgId === orgId)
          benodigd.push({ naam: product.productnaam, soort: "materiaal" });
      }
    }

    // Bus-keten (§3.3): expliciet → dag-override → standaardbus → fallback
    let dagOverrideVoertuigId: Id<"voertuigen"> | null = null;
    let teamStandaardVoertuigId: Id<"voertuigen"> | null = null;
    if (werkitem.teamId) {
      const overrides = await ctx.db
        .query("teamBusOverrides")
        .withIndex("by_team_datum", (q) =>
          q.eq("teamId", werkitem.teamId!).eq("datum", args.datum)
        )
        .collect();
      dagOverrideVoertuigId =
        overrides.find((o) => o.orgId?.toString() === orgId.toString())
          ?.voertuigId ?? null;
      const team = await ctx.db.get(werkitem.teamId);
      teamStandaardVoertuigId = team?.orgId === orgId ? team.standaardVoertuigId ?? null : null;
    }
    let busBron: BusBron | "expliciet" | null;
    let voertuigId: Id<"voertuigen"> | null;
    if (args.voertuigId) {
      voertuigId = args.voertuigId;
      busBron = "expliciet";
    } else {
      const keten = bepaalEffectieveBus({
        dagOverrideVoertuigId,
        teamStandaardVoertuigId,
        toegewezenVoertuigen: werkitem.toegewezenVoertuigen,
      });
      voertuigId = keten.voertuigId;
      busBron = keten.bron;
    }

    // Standaardinventaris van de bus (voertuigUitrusting, status "aanwezig")
    let voertuig: Doc<"voertuigen"> | null = null;
    let inventarisNamen: string[] = [];
    if (voertuigId) {
      voertuig = await ctx.db.get(voertuigId);
      if (!voertuig || voertuig.orgId?.toString() !== orgId.toString()) {
        throw new ConvexError("Voertuig niet gevonden");
      }
      const uitrusting = await ctx.db
        .query("voertuigUitrusting")
        .withIndex("by_voertuig", (q) =>
          q.eq("voertuigId", voertuigId as Id<"voertuigen">)
        )
        .collect();
      inventarisNamen = uitrusting
        .filter((u) => u.status === "aanwezig")
        .map((u) => u.naam);
    }

    const eigenBenodigd = (await ctx.db.query("werkitemBenodigdheden").withIndex("by_werkitem", q => q.eq("werkitemId", werkitem._id)).collect()).filter(b => b.orgId === orgId && !b.verwijderdOp);
    benodigd.push(...eigenBenodigd.map(b => ({ naam: b.naam, soort: b.soort })));
    const suggesties = await suggestiesVoor(ctx, werkitem, orgId, [...benodigd.map(b => b.naam), ...inventarisNamen]);
    const delta = berekenMateriaalDelta(benodigd, inventarisNamen);

    // Afvink-status van vandaag (wie/wanneer, §8.5)
    const checks = await ctx.db
      .query("materiaalChecks")
      .withIndex("by_werkitem_datum", (q) =>
        q.eq("werkitemId", args.werkitemId).eq("datum", args.datum)
      )
      .collect();
    const checksPerItem = new Map(
      checks
        .filter((c) => c.orgId?.toString() === orgId.toString())
        .map((c) => [c.item, c])
    );

    // Maps-URL (gewone URL, geen API): adres van het werkitem of de klant
    let adres = werkitem.adres ?? null;
    if (!adres && werkitem.klantId) {
      const klant = await ctx.db.get(werkitem.klantId);
      if (klant?.orgId === orgId) adres = adresRegelOfNull(klantUitvoerAdres(klant));
    }
    const mapsUrl = adres ? googleMapsRouteUrl(adres) : null;

    const deltaMetStatus = delta.map((item) => {
      const check = checksPerItem.get(normaliseerItemNaam(item.naam)) ?? null;
      return {
        ...item,
        afgevinkt: check !== null,
        afgevinktDoor: check?.doorNaam ?? null,
        afgevinktOp: check?.createdAt ?? null,
      };
    });

    return {
      werkitemId: werkitem._id,
      voertuig: voertuig
        ? { _id: voertuig._id, kenteken: voertuig.kenteken, merk: voertuig.merk }
        : null,
      // Herkomst van de bus-keuze (§3.3): expliciet | dag_override |
      // team_standaard | werkitem_fallback | null (geen bus)
      busBron,
      benodigd,
      suggesties,
      handmatigBenodigd: eigenBenodigd.map(b => ({ id: b._id, naam: b.naam, soort: b.soort, bron: b.bron })),
      kanVerwijderen: toegang.rol === "kantoor",
      delta: deltaMetStatus,
      allesAfgevinkt: deltaMetStatus.every((d) => d.afgevinkt),
      adres,
      mapsUrl,
    };
  },
});

/**
 * Delta-item afvinken (of het vinkje weghalen). Afvinken wordt gelogd met
 * wie/wanneer (§8.5) — idempotent per werkitem+datum+item.
 */
export const vinkAf = mutation({
  args: {
    werkitemId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD
    item: v.string(),
    ongedaan: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    datumCheck(args.datum);
    const toegang = await veldToegang(ctx);
    const { user, orgId } = toegang;

    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.orgId?.toString() !== orgId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }
    await controleerWerkitemToegang(ctx, toegang, werkitem, args.datum);
    const item = normaliseerItemNaam(args.item);
    if (!item) {
      throw new ConvexError("Ongeldig checklist-item");
    }

    const bestaande = await ctx.db
      .query("materiaalChecks")
      .withIndex("by_werkitem_datum", (q) =>
        q.eq("werkitemId", args.werkitemId).eq("datum", args.datum)
      )
      .collect();
    const bestaand = bestaande.find(
      (c) => c.item === item && c.orgId?.toString() === orgId.toString()
    );

    if (args.ongedaan) {
      if (bestaand) await ctx.db.delete(bestaand._id);
      return null;
    }
    if (bestaand) return bestaand._id; // idempotent

    return await ctx.db.insert("materiaalChecks", {
      orgId,
      werkitemId: args.werkitemId,
      datum: args.datum,
      item,
      door: user._id,
      doorNaam: user.name,
      createdAt: Date.now(),
    });
  },
});

export const voegBenodigdheidToe = mutation({
  args: { werkitemId: v.id("projecten"), datum: v.string(), naam: v.string(), soort: v.union(v.literal("machine"), v.literal("materiaal")), bron: v.union(v.literal("handmatig"), v.literal("suggestie")) },
  handler: async (ctx, args) => {
    datumCheck(args.datum);
    const toegang = await veldToegang(ctx);
    const werkitem = await ctx.db.get(args.werkitemId);
    if (!werkitem || werkitem.deletedAt || werkitem.orgId !== toegang.orgId) throw new ConvexError("Werkitem niet gevonden");
    await controleerWerkitemToegang(ctx, toegang, werkitem, args.datum);
    const naam = args.naam.trim().replace(/\s+/g, " ");
    if (!naam || naam.length > 160) throw new ConvexError("Vul een benodigdheid van maximaal 160 tekens in");
    const bestaand = (await ctx.db.query("werkitemBenodigdheden").withIndex("by_werkitem", q => q.eq("werkitemId", werkitem._id)).collect()).find(b => b.orgId === toegang.orgId && !b.verwijderdOp && normaliseerItemNaam(b.naam) === normaliseerItemNaam(naam));
    if (bestaand) return bestaand._id;
    if (args.bron === "suggestie") {
      const suggesties = await suggestiesVoor(ctx, werkitem, toegang.orgId);
      if (!suggesties.some(s => normaliseerItemNaam(s.naam) === normaliseerItemNaam(naam) && s.soort === args.soort)) throw new ConvexError("Deze suggestie is gewijzigd. Vernieuw de checklist.");
    }
    return ctx.db.insert("werkitemBenodigdheden", { orgId: toegang.orgId, werkitemId: werkitem._id, naam, soort: args.soort, bron: args.bron, door: toegang.user._id, createdAt: Date.now() });
  },
});

export const verwijderBenodigdheid = mutation({
  args: { id: v.id("werkitemBenodigdheden"), datum: v.string() },
  handler: async (ctx, args) => {
    datumCheck(args.datum);
    const toegang = await veldToegang(ctx);
    if (toegang.rol !== "kantoor") throw new ConvexError("Alleen kantoor kan een benodigdheid verwijderen");
    const rij = await ctx.db.get(args.id);
    if (!rij || rij.orgId !== toegang.orgId) throw new ConvexError("Benodigdheid niet gevonden");
    await ctx.db.patch(rij._id, { verwijderdOp: Date.now() });
    // Historical checks deliberately survive removing a future requirement.
  },
});

export const getSuggestieRegels = query({
  args: {},
  handler: async ctx => {
    const toegang = await veldToegang(ctx);
    if (toegang.rol !== "kantoor") throw new ConvexError("Alleen kantoor kan suggestieregels beheren");
    const regels = await ctx.db.query("materiaalSuggestieRegels").withIndex("by_org", q => q.eq("orgId", toegang.orgId)).collect();
    return effectieveMateriaalRegels(regels);
  },
});

export const bewaarSuggestieRegel = mutation({
  args: { trefwoord: v.string(), naam: v.string(), soort: v.union(v.literal("machine"), v.literal("materiaal")), actief: v.boolean() },
  handler: async (ctx, args) => {
    const toegang = await veldToegang(ctx);
    if (toegang.rol !== "kantoor") throw new ConvexError("Alleen kantoor kan suggestieregels beheren");
    const trefwoord = args.trefwoord.trim().toLocaleLowerCase("nl"), naam = args.naam.trim();
    if (!trefwoord || trefwoord.length > 100 || !naam || naam.length > 160) throw new ConvexError("Vul een trefwoord en materiaalnaam in (maximaal 100 en 160 tekens)");
    const regels = await ctx.db.query("materiaalSuggestieRegels").withIndex("by_org", q => q.eq("orgId", toegang.orgId)).collect();
    const rij = regels.find(r => normaliseerItemNaam(r.trefwoord) === normaliseerItemNaam(trefwoord) && normaliseerItemNaam(r.naam) === normaliseerItemNaam(naam));
    if (rij) { await ctx.db.patch(rij._id, { soort: args.soort, actief: args.actief, door: toegang.user._id, updatedAt: Date.now() }); return rij._id; }
    return ctx.db.insert("materiaalSuggestieRegels", { orgId: toegang.orgId, trefwoord, naam, soort: args.soort, actief: args.actief, door: toegang.user._id, createdAt: Date.now(), updatedAt: Date.now() });
  },
});
